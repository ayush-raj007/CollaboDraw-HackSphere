import { useRef, useEffect, useState, useCallback } from "react";
import type { CursorState, Point, ToolType, WhiteboardElement } from "@/lib/whiteboard-types";

interface CanvasProps {
  elements: WhiteboardElement[];
  tool: ToolType;
  color: string;
  strokeWidth: number;
  readOnly: boolean;
  selectedId: string | null;
  cursors: Record<string, CursorState>;
  lasers: Record<string, CursorState>;
  onCommit: (elements: WhiteboardElement[]) => void;
  onSelect: (id: string | null) => void;
  onCursorMove: (x: number, y: number) => void;
  onLaser: (x: number, y: number) => void;
  onRequestText: (x: number, y: number) => void;
  onImageDrop: (x: number, y: number, src: string, w: number, h: number) => void;
}

function distToSegment(p: Point, a: Point, b: Point) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

function hitTest(el: WhiteboardElement, p: Point): boolean {
  if (el.type === "path") {
    const pts = el.points ?? [];
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(p, pts[i]!, pts[i + 1]!) <= Math.max(8, el.strokeWidth)) return true;
    }
    return false;
  }
  if (el.type === "line") {
    const pts = el.points ?? [];
    if (pts.length < 2) return false;
    return distToSegment(p, pts[0]!, pts[1]!) <= Math.max(8, el.strokeWidth);
  }
  return p.x >= el.x && p.x <= el.x + el.width && p.y >= el.y && p.y <= el.y + el.height;
}

function boundsOf(el: WhiteboardElement) {
  if (el.type === "path" || el.type === "line") {
    const pts = el.points ?? [];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

function drawElement(ctx: CanvasRenderingContext2D, el: WhiteboardElement, images: Map<string, HTMLImageElement>) {
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (el.type === "path") {
    const pts = el.points ?? [];
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else if (el.type === "line") {
    const pts = el.points ?? [];
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    ctx.lineTo(pts[1]!.x, pts[1]!.y);
    ctx.stroke();
  } else if (el.type === "rectangle") {
    ctx.strokeRect(el.x, el.y, el.width, el.height);
  } else if (el.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, Math.abs(el.width / 2), Math.abs(el.height / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (el.type === "text") {
    ctx.font = `${el.fontSize ?? 20}px Inter, sans-serif`;
    ctx.textBaseline = "top";
    const lines = (el.text ?? "").split("\n");
    lines.forEach((line, i) => ctx.fillText(line, el.x, el.y + i * (el.fontSize ?? 20) * 1.3));
  } else if (el.type === "sticky") {
    ctx.fillStyle = el.color;
    ctx.fillRect(el.x, el.y, el.width, el.height);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(el.x, el.y, el.width, el.height);
    ctx.fillStyle = "#1f2937";
    ctx.font = "14px Inter, sans-serif";
    ctx.textBaseline = "top";
    const words = (el.text ?? "").split("\n");
    words.forEach((line, i) => ctx.fillText(line, el.x + 10, el.y + 10 + i * 18, el.width - 20));
  } else if (el.type === "image" && el.src) {
    const img = images.get(el.id);
    if (img && img.complete) {
      ctx.drawImage(img, el.x, el.y, el.width, el.height);
    }
  }
}

export function WhiteboardCanvas({
  elements,
  tool,
  color,
  strokeWidth,
  readOnly,
  selectedId,
  cursors,
  lasers,
  onCommit,
  onSelect,
  onCursorMove,
  onLaser,
  onRequestText,
  onImageDrop,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<WhiteboardElement | null>(null);
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [, forceRerender] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    for (const el of elements) {
      if (el.type === "image" && el.src && !imagesRef.current.has(el.id)) {
        const img = new Image();
        img.src = el.src;
        img.onload = () => forceRerender((n) => n + 1);
        imagesRef.current.set(el.id, img);
      }
    }
  }, [elements]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.width, size.height);

    for (const el of elements) {
      drawElement(ctx, el, imagesRef.current);
    }

    if (drawingRef.current) {
      drawElement(ctx, drawingRef.current, imagesRef.current);
    }

    if (selectedId) {
      const el = elements.find((e) => e.id === selectedId);
      if (el) {
        const b = boundsOf(el);
        ctx.save();
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(b.x - 4, b.y - 4, b.width + 8, b.height + 8);
        ctx.restore();
      }
    }
  }, [elements, size, selectedId]);

  useEffect(() => {
    render();
  });

  const getPoint = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const p = getPoint(e);
    if (readOnly) return;

    if (tool === "select") {
      const hit = [...elements].reverse().find((el) => hitTest(el, p));
      onSelect(hit ? hit.id : null);
      if (hit) {
        draggingRef.current = { id: hit.id, offsetX: p.x - hit.x, offsetY: p.y - hit.y };
      }
      return;
    }

    if (tool === "eraser") {
      const hit = [...elements].reverse().find((el) => hitTest(el, p));
      if (hit) onCommit(elements.filter((el) => el.id !== hit.id));
      return;
    }

    if (tool === "text") {
      onRequestText(p.x, p.y);
      return;
    }

    if (tool === "sticky") {
      const el: WhiteboardElement = {
        id: crypto.randomUUID(),
        type: "sticky",
        x: p.x,
        y: p.y,
        width: 180,
        height: 140,
        color: "#fde68a",
        strokeWidth,
        text: "",
      };
      onCommit([...elements, el]);
      onSelect(el.id);
      return;
    }

    const id = crypto.randomUUID();
    if (tool === "pen") {
      drawingRef.current = { id, type: "path", x: p.x, y: p.y, width: 0, height: 0, color, strokeWidth, points: [p] };
    } else if (tool === "line") {
      drawingRef.current = { id, type: "line", x: p.x, y: p.y, width: 0, height: 0, color, strokeWidth, points: [p, p] };
    } else if (tool === "rectangle") {
      drawingRef.current = { id, type: "rectangle", x: p.x, y: p.y, width: 0, height: 0, color, strokeWidth };
    } else if (tool === "ellipse") {
      drawingRef.current = { id, type: "ellipse", x: p.x, y: p.y, width: 0, height: 0, color, strokeWidth };
    }
    render();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const p = getPoint(e);
    onCursorMove(p.x, p.y);

    if (readOnly) return;

    if (draggingRef.current) {
      const { id, offsetX, offsetY } = draggingRef.current;
      const next = elements.map((el) => {
        if (el.id !== id) return el;
        const dx = p.x - offsetX - el.x;
        const dy = p.y - offsetY - el.y;
        if (el.points) {
          return { ...el, x: el.x + dx, y: el.y + dy, points: el.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) };
        }
        return { ...el, x: p.x - offsetX, y: p.y - offsetY };
      });
      onCommit(next);
      return;
    }

    const drawing = drawingRef.current;
    if (!drawing) return;

    if (drawing.type === "path") {
      drawing.points = [...(drawing.points ?? []), p];
    } else if (drawing.type === "line") {
      drawing.points = [drawing.points![0]!, p];
    } else {
      drawing.width = p.x - drawing.x;
      drawing.height = p.y - drawing.y;
    }
    render();
  };

  const handlePointerUp = () => {
    if (draggingRef.current) {
      draggingRef.current = null;
      return;
    }
    const drawing = drawingRef.current;
    if (!drawing) return;
    drawingRef.current = null;

    let normalized = drawing;
    if (drawing.type === "rectangle" || drawing.type === "ellipse") {
      normalized = {
        ...drawing,
        x: Math.min(drawing.x, drawing.x + drawing.width),
        y: Math.min(drawing.y, drawing.y + drawing.height),
        width: Math.abs(drawing.width),
        height: Math.abs(drawing.height),
      };
    }
    if ((normalized.type === "rectangle" || normalized.type === "ellipse") && (normalized.width < 3 || normalized.height < 3)) return;
    if (normalized.type === "path" && (normalized.points?.length ?? 0) < 2) return;

    onCommit([...elements, normalized]);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[repeating-linear-gradient(0deg,transparent,transparent_23px,hsl(var(--border)/0.4)_24px),repeating-linear-gradient(90deg,transparent,transparent_23px,hsl(var(--border)/0.4)_24px)] bg-card"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const rect = containerRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const w = Math.min(320, img.width);
            const h = w * (img.height / img.width);
            onImageDrop(x - w / 2, y - h / 2, reader.result as string, w, h);
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      }}
    >
      <canvas
        ref={canvasRef}
        className={tool === "eraser" ? "cursor-cell" : tool === "select" ? "cursor-default" : "cursor-crosshair"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      {Object.values(cursors).map((c) => (
        <div key={c.userId} className="pointer-events-none absolute z-20 -translate-x-0.5 -translate-y-0.5 transition-transform duration-75" style={{ left: c.x, top: c.y }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M2 2L18 8L10 10L8 18L2 2Z" fill={c.color} stroke="white" strokeWidth="1" />
          </svg>
          <span className="ml-3 -mt-1 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow" style={{ backgroundColor: c.color }}>
            {c.name}
          </span>
        </div>
      ))}
      {Object.values(lasers).map((c) => (
        <div
          key={`laser-${c.userId}`}
          className="pointer-events-none absolute z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping"
          style={{ left: c.x, top: c.y, backgroundColor: c.color }}
        />
      ))}
    </div>
  );
}
