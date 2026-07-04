import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, or } from "drizzle-orm";
import { db, boardsTable, boardCollaboratorsTable, usersTable, type BoardRole } from "@workspace/db";
import {
  ListBoardsResponse,
  CreateBoardBody,
  CreateBoardResponse,
  GetBoardResponse,
  UpdateBoardBody,
  UpdateBoardResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function param(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

function requireAuth(req: Request, res: Response): string | null {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.user.id;
}

function userName(user: { firstName: string | null; lastName: string | null; email: string | null } | null | undefined) {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email || null;
}

async function getRoleForBoard(boardId: string, userId: string): Promise<{ role: BoardRole; ownerId: string } | null> {
  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, boardId));
  if (!board) return null;
  if (board.ownerId === userId) return { role: "owner", ownerId: board.ownerId };

  const [collab] = await db
    .select()
    .from(boardCollaboratorsTable)
    .where(and(eq(boardCollaboratorsTable.boardId, boardId), eq(boardCollaboratorsTable.userId, userId)));

  if (!collab) return null;
  return { role: collab.role as BoardRole, ownerId: board.ownerId };
}

router.get("/boards", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const owned = await db
    .select({ board: boardsTable, owner: usersTable })
    .from(boardsTable)
    .leftJoin(usersTable, eq(usersTable.id, boardsTable.ownerId))
    .where(eq(boardsTable.ownerId, userId));

  const shared = await db
    .select({ board: boardsTable, owner: usersTable, role: boardCollaboratorsTable.role })
    .from(boardCollaboratorsTable)
    .innerJoin(boardsTable, eq(boardsTable.id, boardCollaboratorsTable.boardId))
    .leftJoin(usersTable, eq(usersTable.id, boardsTable.ownerId))
    .where(eq(boardCollaboratorsTable.userId, userId));

  const collabCounts = new Map<string, number>();
  const allBoardIds = [...owned.map((o) => o.board.id), ...shared.map((s) => s.board.id)];
  if (allBoardIds.length > 0) {
    const collabRows = await db.select().from(boardCollaboratorsTable);
    for (const row of collabRows) {
      if (allBoardIds.includes(row.boardId)) {
        collabCounts.set(row.boardId, (collabCounts.get(row.boardId) ?? 0) + 1);
      }
    }
  }

  const result = [
    ...owned.map((o) => ({
      id: o.board.id,
      name: o.board.name,
      ownerId: o.board.ownerId,
      ownerName: userName(o.owner),
      role: "owner" as const,
      collaboratorCount: collabCounts.get(o.board.id) ?? 0,
      createdAt: o.board.createdAt,
      updatedAt: o.board.updatedAt,
    })),
    ...shared.map((s) => ({
      id: s.board.id,
      name: s.board.name,
      ownerId: s.board.ownerId,
      ownerName: userName(s.owner),
      role: s.role as BoardRole,
      collaboratorCount: collabCounts.get(s.board.id) ?? 0,
      createdAt: s.board.createdAt,
      updatedAt: s.board.updatedAt,
    })),
  ];

  res.json(ListBoardsResponse.parse(result));
});

router.post("/boards", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = CreateBoardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid board data" });
    return;
  }

  const [board] = await db
    .insert(boardsTable)
    .values({ name: parsed.data.name, ownerId: userId, elements: [] })
    .returning();

  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json(
    CreateBoardResponse.parse({
      id: board.id,
      name: board.name,
      ownerId: board.ownerId,
      ownerName: userName(owner),
      role: "owner",
      elements: board.elements as unknown[],
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    }),
  );
});

router.get("/boards/:id", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const roleInfo = await getRoleForBoard(param(req, "id"), userId);
  if (!roleInfo) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, param(req, "id")));
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, roleInfo.ownerId));

  res.json(
    GetBoardResponse.parse({
      id: board.id,
      name: board.name,
      ownerId: board.ownerId,
      ownerName: userName(owner),
      role: roleInfo.role,
      elements: board.elements as unknown[],
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    }),
  );
});

router.patch("/boards/:id", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const roleInfo = await getRoleForBoard(param(req, "id"), userId);
  if (!roleInfo) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  if (roleInfo.role === "viewer") {
    res.status(403).json({ error: "Viewers cannot edit this board" });
    return;
  }

  const parsed = UpdateBoardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update data" });
    return;
  }

  const [board] = await db
    .update(boardsTable)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.elements !== undefined ? { elements: parsed.data.elements } : {}),
    })
    .where(eq(boardsTable.id, param(req, "id")))
    .returning();

  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, roleInfo.ownerId));

  res.json(
    UpdateBoardResponse.parse({
      id: board.id,
      name: board.name,
      ownerId: board.ownerId,
      ownerName: userName(owner),
      role: roleInfo.role,
      elements: board.elements as unknown[],
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    }),
  );
});

router.delete("/boards/:id", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, param(req, "id")));
  if (!board || board.ownerId !== userId) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  await db.delete(boardsTable).where(eq(boardsTable.id, param(req, "id")));
  res.status(204).end();
});

export { requireAuth, userName, getRoleForBoard, param };
export default router;
