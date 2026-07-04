import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parseCookie } from "cookie";
import { getSession, SESSION_COOKIE } from "../lib/auth";
import { db, boardsTable, boardCollaboratorsTable, boardChatMessagesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

interface ClientInfo {
  ws: WebSocket;
  boardId: string;
  userId: string;
  name: string;
  color: string;
}

const boards = new Map<string, Set<ClientInfo>>();

const PALETTE = ["#f97316", "#6366f1", "#10b981", "#ec4899", "#14b8a6", "#eab308", "#8b5cf6", "#ef4444"];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

async function getRole(boardId: string, userId: string): Promise<string | null> {
  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, boardId));
  if (!board) return null;
  if (board.ownerId === userId) return "owner";
  const [collab] = await db
    .select()
    .from(boardCollaboratorsTable)
    .where(and(eq(boardCollaboratorsTable.boardId, boardId), eq(boardCollaboratorsTable.userId, userId)));
  return collab?.role ?? null;
}

function broadcast(boardId: string, payload: unknown, exclude?: ClientInfo) {
  const set = boards.get(boardId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const client of set) {
    if (client === exclude) continue;
    if (client.ws.readyState === WebSocket.OPEN) client.ws.send(data);
  }
}

function presenceList(boardId: string) {
  const set = boards.get(boardId);
  if (!set) return [];
  return [...set].map((c) => ({ userId: c.userId, name: c.name, color: c.color }));
}

export function setupWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", "http://localhost");
    if (!url.pathname.startsWith("/api/ws")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, url);
    });
  });

  wss.on("connection", async (ws: WebSocket, req: import("http").IncomingMessage, url: URL) => {
    const cookies = parseCookie(req.headers.cookie ?? "");
    const authHeader = req.headers["authorization"];
    const sid = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookies[SESSION_COOKIE];
    const boardId = url.searchParams.get("boardId");

    if (!sid || !boardId) {
      ws.close(4001, "Missing auth or boardId");
      return;
    }

    const session = await getSession(sid);
    if (!session?.user?.id) {
      ws.close(4001, "Not authenticated");
      return;
    }

    const role = await getRole(boardId, session.user.id);
    if (!role) {
      ws.close(4003, "Not authorized for this board");
      return;
    }

    const name =
      [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") ||
      session.user.email ||
      "Anonymous";

    const client: ClientInfo = {
      ws,
      boardId,
      userId: session.user.id,
      name,
      color: colorFor(session.user.id),
    };

    if (!boards.has(boardId)) boards.set(boardId, new Set());
    boards.get(boardId)!.add(client);

    ws.send(JSON.stringify({ type: "presence", users: presenceList(boardId) }));
    broadcast(boardId, { type: "presence", users: presenceList(boardId) });

    ws.on("message", async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === "cursor" || msg.type === "laser") {
        broadcast(
          boardId,
          { type: msg.type, userId: client.userId, name: client.name, color: client.color, x: msg.x, y: msg.y },
          client,
        );
        return;
      }

      if (msg.type === "draw") {
        if (role === "viewer") return;
        broadcast(boardId, { type: "draw", userId: client.userId, elements: msg.elements }, client);
        return;
      }

      if (msg.type === "chat") {
        if (typeof msg.message !== "string" || !msg.message.trim()) return;
        try {
          const [row] = await db
            .insert(boardChatMessagesTable)
            .values({ boardId, userId: client.userId, message: msg.message.trim() })
            .returning();
          broadcast(boardId, {
            type: "chat",
            id: row.id,
            userId: client.userId,
            name: client.name,
            message: row.message,
            createdAt: row.createdAt,
          });
        } catch (err) {
          logger.error({ err }, "Failed to persist chat message");
        }
        return;
      }
    });

    ws.on("close", () => {
      boards.get(boardId)?.delete(client);
      if (boards.get(boardId)?.size === 0) boards.delete(boardId);
      broadcast(boardId, { type: "presence", users: presenceList(boardId) });
    });
  });

  return wss;
}
