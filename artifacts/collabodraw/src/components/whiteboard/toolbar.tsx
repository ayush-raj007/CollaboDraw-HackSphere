import { useRef } from "react";
import type { ToolType } from "@/lib/whiteboard-types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MousePointer2,
  Pencil,
  Minus,
  Square,
  Circle,
  Eraser,
  Type,
  StickyNote,
  ImagePlus,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Flashlight,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const TOOLS: { id: ToolType; icon: typeof MousePointer2; label: string; shortcut: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select / move", shortcut: "V" },
  { id: "pen", icon: Pencil, label: "Pen", shortcut: "P" },
  { id: "line", icon: Minus, label: "Line", shortcut: "L" },
  { id: "rectangle", icon: Square, label: "Rectangle", shortcut: "R" },
  { id: "ellipse", icon: Circle, label: "Ellipse", shortcut: "O" },
  { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E" },
  { id: "text", icon: Type, label: "Text", shortcut: "T" },
  { id: "sticky", icon: StickyNote, label: "Sticky note", shortcut: "N" },
];

const PALETTE = ["#1f2937", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff"];

interface ToolbarProps {
  tool: ToolType;
  onToolChange: (t: ToolType) => void;
  color: string;
  onColorChange: (c: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onImageUpload: (file: File) => void;
  onExport: (format: "png" | "jpeg" | "pdf") => void;
  onLaserToggle: () => void;
  laserActive: boolean;
  readOnly: boolean;
}

export function Toolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onImageUpload,
  onExport,
  onLaserToggle,
  laserActive,
  readOnly,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-card-border bg-card p-2 shadow-lg">
      {!readOnly &&
        TOOLS.map(({ id, icon: Icon, label, shortcut }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={tool === id ? "default" : "ghost"}
                onClick={() => onToolChange(id)}
                data-testid={`tool-${id}`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {label} ({shortcut})
            </TooltipContent>
          </Tooltip>
        ))}

      {!readOnly && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} data-testid="tool-image">
                <ImagePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert image (I)</TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageUpload(file);
              e.target.value = "";
            }}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant={laserActive ? "default" : "ghost"} onClick={onLaserToggle} data-testid="tool-laser">
                <Flashlight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Laser pointer</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" style={{ color }} data-testid="tool-color">
                <div className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: color }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  className="h-6 w-6 rounded-full border border-border hover-elevate active-elevate-2"
                  style={{ backgroundColor: c }}
                  onClick={() => onColorChange(c)}
                  data-testid={`color-${c}`}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            type="range"
            min={1}
            max={20}
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            className="w-20 accent-primary"
            data-testid="stroke-width"
          />

          <Separator orientation="vertical" className="mx-1 h-6" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={onUndo} disabled={!canUndo} data-testid="button-undo">
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={onRedo} disabled={!canRedo} data-testid="button-redo">
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={onClear} data-testid="button-clear">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear page</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-6" />
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" data-testid="button-export">
            <Download className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onExport("png")}>Export PNG</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("jpeg")}>Export JPEG</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("pdf")}>Export PDF</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
