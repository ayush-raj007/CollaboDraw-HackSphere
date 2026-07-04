import { Router, type IRouter, type Request, type Response } from "express";
import { asc, eq } from "drizzle-orm";
import { db, boardChatMessagesTable, usersTable } from "@workspace/db";
import { ListChatMessagesResponse } from "@workspace/api-zod";
import { requireAuth, userName, getRoleForBoard, param } from "./boards";

const router: IRouter = Router();

router.get("/boards/:id/chat", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const roleInfo = await getRoleForBoard(param(req, "id"), userId);
  if (!roleInfo) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const rows = await db
    .select({ msg: boardChatMessagesTable, user: usersTable })
    .from(boardChatMessagesTable)
    .leftJoin(usersTable, eq(usersTable.id, boardChatMessagesTable.userId))
    .where(eq(boardChatMessagesTable.boardId, param(req, "id")))
    .orderBy(asc(boardChatMessagesTable.createdAt))
    .limit(200);

  res.json(
    ListChatMessagesResponse.parse(
      rows.map((r) => ({
        id: r.msg.id,
        boardId: r.msg.boardId,
        userId: r.msg.userId,
        userName: userName(r.user),
        profileImageUrl: r.user?.profileImageUrl ?? null,
        message: r.msg.message,
        createdAt: r.msg.createdAt,
      })),
    ),
  );
});

export default router;
