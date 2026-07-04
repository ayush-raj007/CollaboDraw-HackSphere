import { useEffect, useRef, useState, useCallback } from "react";
import type { CursorState, PresenceUser, ChatEntry, WhiteboardElement } from "./whiteboard-types";

interface UseBoardSocketOptions {
  boardId: string | undefined;
  pageId: string;
  onRemoteElements: (pageId: string, elements: WhiteboardElement[]) => void;
  onChat: (entry: ChatEntry) => void;
}

export function useBoardSocket({ boardId, pageId, onRemoteElements, onChat }: UseBoardSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorState>>({});
  const [lasers, setLasers] = useState<Record<string, CursorState>>({});
  const pageIdRef = useRef(pageId);
  pageIdRef.current = pageId;

  const onRemoteElementsRef = useRef(onRemoteElements);
  onRemoteElementsRef.current = onRemoteElements;
  const onChatRef = useRef(onChat);
  onChatRef.current = onChat;

  useEffect(() => {
    if (!boardId) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const base = import.meta.env.BASE_URL.endsWith("/")
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    const url = `${proto}//${window.location.host}${base}api/ws?boardId=${encodeURIComponent(boardId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "presence") {
        setPresence(msg.users);
        return;
      }
      if (msg.type === "cursor") {
        setCursors((prev) => ({
          ...prev,
          [msg.userId]: { userId: msg.userId, name: msg.name, color: msg.color, x: msg.x, y: msg.y, updatedAt: Date.now() },
        }));
        return;
      }
      if (msg.type === "laser") {
        setLasers((prev) => ({
          ...prev,
          [msg.userId]: { userId: msg.userId, name: msg.name, color: msg.color, x: msg.x, y: msg.y, updatedAt: Date.now() },
        }));
        setTimeout(() => {
          setLasers((prev) => {
            const copy = { ...prev };
            if (copy[msg.userId]?.updatedAt && Date.now() - copy[msg.userId].updatedAt >= 900) {
              delete copy[msg.userId];
            }
            return copy;
          });
        }, 1000);
        return;
      }
      if (msg.type === "draw") {
        onRemoteElementsRef.current(msg.pageId ?? pageIdRef.current, msg.elements);
        return;
      }
      if (msg.type === "chat") {
        onChatRef.current({ id: msg.id, userId: msg.userId, name: msg.name, message: msg.message, createdAt: msg.createdAt });
        return;
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [boardId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursors((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, CursorState> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.updatedAt < 8000) {
            next[k] = v;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const send = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const sendDraw = useCallback(
    (elements: WhiteboardElement[]) => send({ type: "draw", pageId: pageIdRef.current, elements }),
    [send],
  );
  const sendCursor = useCallback((x: number, y: number) => send({ type: "cursor", x, y }), [send]);
  const sendLaser = useCallback((x: number, y: number) => send({ type: "laser", x, y }), [send]);
  const sendChat = useCallback((message: string) => send({ type: "chat", message }), [send]);

  return { connected, presence, cursors, lasers, sendDraw, sendCursor, sendLaser, sendChat };
}
