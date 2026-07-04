export type ToolType =
  | "select"
  | "pen"
  | "line"
  | "rectangle"
  | "ellipse"
  | "eraser"
  | "text"
  | "sticky"
  | "image";

export interface Point {
  x: number;
  y: number;
}

export interface WhiteboardElement {
  id: string;
  type: "path" | "line" | "rectangle" | "ellipse" | "text" | "sticky" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  points?: Point[];
  text?: string;
  fontSize?: number;
  src?: string;
}

export interface WhiteboardPage {
  id: string;
  name: string;
  elements: WhiteboardElement[];
}

export interface WhiteboardData {
  pages: WhiteboardPage[];
  activePageId: string;
}

export function createEmptyBoard(): WhiteboardData {
  const pageId = crypto.randomUUID();
  return {
    pages: [{ id: pageId, name: "Page 1", elements: [] }],
    activePageId: pageId,
  };
}

export function parseBoardData(raw: unknown[]): WhiteboardData {
  const first = raw?.[0] as Partial<WhiteboardData> | undefined;
  if (first && Array.isArray(first.pages) && first.pages.length > 0) {
    return {
      pages: first.pages,
      activePageId: first.activePageId ?? first.pages[0]!.id,
    };
  }
  return createEmptyBoard();
}

export function serializeBoardData(data: WhiteboardData): unknown[] {
  return [data];
}

export interface PresenceUser {
  userId: string;
  name: string;
  color: string;
}

export interface CursorState extends PresenceUser {
  x: number;
  y: number;
  updatedAt: number;
}

export interface ChatEntry {
  id: string;
  userId: string;
  name: string;
  message: string;
  createdAt: string;
}
