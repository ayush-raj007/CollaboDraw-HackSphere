import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, ilike, or } from "drizzle-orm";
import { db, boardsTable, boardCollaboratorsTable, usersTable } from "@workspace/db";
import {
  ListCollaboratorsResponse,
  AddCollaboratorBody,
  AddCollaboratorResponse,
  UpdateCollaboratorRoleBody,
  UpdateCollaboratorRoleResponse,
  SearchUsersResponse,
} from "@workspace/api-zod";
import { requireAuth, userName, getRoleForBoard, param } from "./boards";

const router: IRouter = Router();

router.get("/boards/:id/collaborators", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const roleInfo = await getRoleForBoard(param(req, "id"), userId);
  if (!roleInfo) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, param(req, "id")));
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, board.ownerId));

  const rows = await db
    .select({ collab: boardCollaboratorsTable, user: usersTable })
    .from(boardCollaboratorsTable)
    .leftJoin(usersTable, eq(usersTable.id, boardCollaboratorsTable.userId))
    .where(eq(boardCollaboratorsTable.boardId, param(req, "id")));

  const result = [
    {
      userId: board.ownerId,
      boardId: board.id,
      role: "owner" as const,
      name: userName(owner),
      email: owner?.email ?? null,
      profileImageUrl: owner?.profileImageUrl ?? null,
    },
    ...rows.map((r) => ({
      userId: r.collab.userId,
      boardId: r.collab.boardId,
      role: r.collab.role as "owner" | "editor" | "viewer",
      name: userName(r.user),
      email: r.user?.email ?? null,
      profileImageUrl: r.user?.profileImageUrl ?? null,
    })),
  ];

  res.json(ListCollaboratorsResponse.parse(result));
});

router.post("/boards/:id/collaborators", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, param(req, "id")));
  if (!board || board.ownerId !== userId) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const parsed = AddCollaboratorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid collaborator data" });
    return;
  }

  const [invitedUser] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!invitedUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(boardCollaboratorsTable)
    .where(and(eq(boardCollaboratorsTable.boardId, param(req, "id")), eq(boardCollaboratorsTable.userId, parsed.data.userId)));

  let collab;
  if (existing) {
    [collab] = await db
      .update(boardCollaboratorsTable)
      .set({ role: parsed.data.role })
      .where(eq(boardCollaboratorsTable.id, existing.id))
      .returning();
  } else {
    [collab] = await db
      .insert(boardCollaboratorsTable)
      .values({ boardId: param(req, "id"), userId: parsed.data.userId, role: parsed.data.role })
      .returning();
  }

  res.status(201).json(
    AddCollaboratorResponse.parse({
      userId: collab.userId,
      boardId: collab.boardId,
      role: collab.role,
      name: userName(invitedUser),
      email: invitedUser.email,
      profileImageUrl: invitedUser.profileImageUrl,
    }),
  );
});

router.patch("/boards/:id/collaborators/:userId", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, param(req, "id")));
  if (!board || board.ownerId !== userId) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const parsed = UpdateCollaboratorRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const [collab] = await db
    .update(boardCollaboratorsTable)
    .set({ role: parsed.data.role })
    .where(and(eq(boardCollaboratorsTable.boardId, param(req, "id")), eq(boardCollaboratorsTable.userId, param(req, "userId"))))
    .returning();

  if (!collab) {
    res.status(404).json({ error: "Collaborator not found" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, param(req, "userId")));

  res.json(
    UpdateCollaboratorRoleResponse.parse({
      userId: collab.userId,
      boardId: collab.boardId,
      role: collab.role,
      name: userName(user),
      email: user?.email ?? null,
      profileImageUrl: user?.profileImageUrl ?? null,
    }),
  );
});

router.delete("/boards/:id/collaborators/:userId", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, param(req, "id")));
  if (!board || (board.ownerId !== userId && userId !== param(req, "userId"))) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  await db
    .delete(boardCollaboratorsTable)
    .where(and(eq(boardCollaboratorsTable.boardId, param(req, "id")), eq(boardCollaboratorsTable.userId, param(req, "userId"))));

  res.status(204).end();
});

router.get("/users/search", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q.trim()) {
    res.json(SearchUsersResponse.parse([]));
    return;
  }

  const rows = await db
    .select()
    .from(usersTable)
    .where(or(ilike(usersTable.email, `%${q}%`), ilike(usersTable.firstName, `%${q}%`), ilike(usersTable.lastName, `%${q}%`)))
    .limit(10);

  res.json(
    SearchUsersResponse.parse(
      rows
        .filter((u) => u.id !== userId)
        .map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          profileImageUrl: u.profileImageUrl,
        })),
    ),
  );
});

export default router;
