import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBoard,
  useUpdateBoard,
  useListCollaborators,
  useAddCollaborator,
  useUpdateCollaboratorRole,
  useRemoveCollaborator,
  useSearchUsers,
  useListChatMessages,
  getListCollaboratorsQueryKey,
  getSearchUsersQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { WhiteboardCanvas } from "@/components/whiteboard/canvas";
import { Toolbar } from "@/components/whiteboard/toolbar";
import { PresencePanel } from "@/components/whiteboard/presence-panel";
import { ChatPanel } from "@/components/whiteboard/chat-panel";
import { useBoardSocket } from "@/lib/use-board-socket";
import {
  createEmptyBoard,
  parseBoardData,
  serializeBoardData,
  type ChatEntry,
  type ToolType,
  type WhiteboardData,
  type WhiteboardElement,
} from "@/lib/whiteboard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  ArrowLeft,
  MessageSquare,
  Share2,
  Plus,
  X,
  Check,
  Copy,
} from "lucide-react";

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return useCallback(
    (...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay],
  );
}

export default function BoardPage({ boardId }: { boardId: string }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: board, isLoading, isError, error } = useGetBoard(boardId);
  const updateBoard = useUpdateBoard();

  const [data, setData] = useState<WhiteboardData>(createEmptyBoard());
  const [loadedFromServer, setLoadedFromServer] = useState(false);
  const [tool, setTool] = useState<ToolType>("pen");
  const [color, setColor] = useState("#1f2937");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [laserActive, setLaserActive] = useState(false);
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);

  const historyRef = useRef<Record<string, WhiteboardElement[][]>>({});
  const redoRef = useRef<Record<string, WhiteboardElement[][]>>({});
  const [, forceHistoryRerender] = useState(0);

  useEffect(() => {
    if (board && !loadedFromServer) {
      setData(parseBoardData(board.elements as unknown[]));
      setLoadedFromServer(true);
    }
  }, [board, loadedFromServer]);

  const activePage = useMemo(
    () => data.pages.find((p) => p.id === data.activePageId) ?? data.pages[0],
    [data],
  );

  const role = board?.role ?? "viewer";
  const readOnly = role === "viewer";

  const { data: chatHistory } = useListChatMessages(boardId);
  useEffect(() => {
    if (chatHistory) {
      setChatMessages(
        chatHistory.map((m) => ({ id: m.id, userId: m.userId, name: m.userName ?? "Someone", message: m.message, createdAt: m.createdAt })),
      );
    }
  }, [chatHistory]);

  const handleRemoteElements = useCallback((pageId: string, elements: WhiteboardElement[]) => {
    setData((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === pageId ? { ...p, elements } : p)),
    }));
  }, []);

  const handleChat = useCallback((entry: ChatEntry) => {
    setChatMessages((prev) => [...prev, entry]);
  }, []);

  const { connected, presence, cursors, lasers, sendDraw, sendCursor, sendLaser, sendChat } = useBoardSocket({
    boardId,
    pageId: activePage?.id ?? "",
    onRemoteElements: handleRemoteElements,
    onChat: handleChat,
  });

  const persist = useDebouncedCallback((next: WhiteboardData) => {
    updateBoard.mutate({ id: boardId, data: { elements: serializeBoardData(next) } });
  }, 800);

  const commitElements = useCallback(
    (elements: WhiteboardElement[], pushHistory = true) => {
      if (!activePage) return;
      if (pushHistory) {
        const stack = historyRef.current[activePage.id] ?? [];
        historyRef.current[activePage.id] = [...stack, activePage.elements];
        redoRef.current[activePage.id] = [];
        forceHistoryRerender((n) => n + 1);
      }
      setData((prev) => {
        const next = { ...prev, pages: prev.pages.map((p) => (p.id === activePage.id ? { ...p, elements } : p)) };
        persist(next);
        return next;
      });
      sendDraw(elements);
    },
    [activePage, persist, sendDraw],
  );

  const undo = useCallback(() => {
    if (!activePage) return;
    const stack = historyRef.current[activePage.id] ?? [];
    if (stack.length === 0) return;
    const previous = stack[stack.length - 1]!;
    historyRef.current[activePage.id] = stack.slice(0, -1);
    redoRef.current[activePage.id] = [...(redoRef.current[activePage.id] ?? []), activePage.elements];
    commitElements(previous, false);
    forceHistoryRerender((n) => n + 1);
  }, [activePage, commitElements]);

  const redo = useCallback(() => {
    if (!activePage) return;
    const stack = redoRef.current[activePage.id] ?? [];
    if (stack.length === 0) return;
    const next = stack[stack.length - 1]!;
    redoRef.current[activePage.id] = stack.slice(0, -1);
    historyRef.current[activePage.id] = [...(historyRef.current[activePage.id] ?? []), activePage.elements];
    commitElements(next, false);
    forceHistoryRerender((n) => n + 1);
  }, [activePage, commitElements]);

  useEffect(() => {
    if (readOnly) return;
    const handler = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        commitElements((activePage?.elements ?? []).filter((el) => el.id !== selectedId));
        setSelectedId(null);
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      const map: Record<string, ToolType> = { v: "select", p: "pen", l: "line", r: "rectangle", o: "ellipse", e: "eraser", t: "text", n: "sticky" };
      const t = map[e.key.toLowerCase()];
      if (t) setTool(t);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, selectedId, activePage, commitElements, readOnly]);

  const handleImageUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const w = Math.min(320, img.width);
          const h = w * (img.height / img.width);
          const el: WhiteboardElement = {
            id: crypto.randomUUID(),
            type: "image",
            x: 120,
            y: 120,
            width: w,
            height: h,
            color: "#000000",
            strokeWidth: 1,
            src: reader.result as string,
          };
          commitElements([...(activePage?.elements ?? []), el]);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    },
    [activePage, commitElements],
  );

  const handleImageDrop = useCallback(
    (x: number, y: number, src: string, w: number, h: number) => {
      const el: WhiteboardElement = {
        id: crypto.randomUUID(),
        type: "image",
        x,
        y,
        width: w,
        height: h,
        color: "#000000",
        strokeWidth: 1,
        src,
      };
      commitElements([...(activePage?.elements ?? []), el]);
    },
    [activePage, commitElements],
  );

  const handleExport = useCallback(
    async (format: "png" | "jpeg" | "pdf") => {
      const canvas = document.querySelector<HTMLCanvasElement>("[data-whiteboard-canvas] canvas");
      if (!canvas) {
        toast.error("Nothing to export yet");
        return;
      }
      if (format === "pdf") {
        const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width, canvas.height] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`${board?.name ?? "board"}.pdf`);
        return;
      }
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const url = canvas.toDataURL(mime, 0.95);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${board?.name ?? "board"}.${format === "jpeg" ? "jpg" : "png"}`;
      a.click();
    },
    [board?.name],
  );

  const addPage = () => {
    const id = crypto.randomUUID();
    setData((prev) => {
      const next = { pages: [...prev.pages, { id, name: `Page ${prev.pages.length + 1}`, elements: [] }], activePageId: id };
      persist(next);
      return next;
    });
  };

  const removePage = (pageId: string) => {
    setData((prev) => {
      if (prev.pages.length <= 1) return prev;
      const pages = prev.pages.filter((p) => p.id !== pageId);
      const activePageId = prev.activePageId === pageId ? pages[0]!.id : prev.activePageId;
      const next = { pages, activePageId };
      persist(next);
      return next;
    });
  };

  if (isError) {
    const status = (error as { response?: { status?: number } } | undefined)?.response?.status;
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <h1 className="text-xl font-semibold">
          {status === 401 ? "You need to log in to open this board" : "You don't have access to this board"}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {status === 401
            ? "Log in to continue, then try the link again."
            : "Ask the board owner to add you as a collaborator. You'll need to log in at least once so they can find you by name or email in the Share dialog."}
        </p>
        <Button onClick={() => navigate("/")} data-testid="button-back-home">
          Go to dashboard
        </Button>
      </div>
    );
  }

  if (isLoading || !board || !activePage) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-card-border bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <EditableBoardName
            name={board.name}
            readOnly={readOnly}
            onRename={(name) => updateBoard.mutate({ id: boardId, data: { name } })}
          />
        </div>
        <div className="flex items-center gap-2">
          <PresencePanel users={presence} connected={connected} />
          {role === "owner" && (
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} data-testid="button-share">
              <Share2 className="mr-1.5 h-4 w-4" /> Share
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => setChatOpen(true)} data-testid="button-chat">
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden" data-whiteboard-canvas>
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <Toolbar
            tool={tool}
            onToolChange={setTool}
            color={color}
            onColorChange={setColor}
            strokeWidth={strokeWidth}
            onStrokeWidthChange={setStrokeWidth}
            canUndo={(historyRef.current[activePage.id]?.length ?? 0) > 0}
            canRedo={(redoRef.current[activePage.id]?.length ?? 0) > 0}
            onUndo={undo}
            onRedo={redo}
            onClear={() => commitElements([])}
            onImageUpload={handleImageUpload}
            onExport={handleExport}
            onLaserToggle={() => setLaserActive((v) => !v)}
            laserActive={laserActive}
            readOnly={readOnly}
          />
        </div>

        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-card-border bg-card px-2 py-1.5 shadow-lg">
          {data.pages.map((p) => (
            <button
              key={p.id}
              onClick={() => setData((prev) => ({ ...prev, activePageId: p.id }))}
              className={`group flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium hover-elevate active-elevate-2 ${p.id === data.activePageId ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              data-testid={`page-tab-${p.id}`}
            >
              {p.name}
              {!readOnly && data.pages.length > 1 && (
                <X
                  className="h-3 w-3 opacity-0 group-hover:opacity-70"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePage(p.id);
                  }}
                />
              )}
            </button>
          ))}
          {!readOnly && (
            <button onClick={addPage} className="rounded-full p-1 hover-elevate active-elevate-2" data-testid="button-add-page">
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <WhiteboardCanvas
          elements={activePage.elements}
          tool={tool}
          color={color}
          strokeWidth={strokeWidth}
          readOnly={readOnly}
          selectedId={selectedId}
          cursors={cursors}
          lasers={lasers}
          onCommit={commitElements}
          onSelect={setSelectedId}
          onCursorMove={(x, y) => {
            sendCursor(x, y);
            if (laserActive) sendLaser(x, y);
          }}
          onLaser={sendLaser}
          onRequestText={(x, y) => {
            setPendingText({ x, y });
            setTextDraft("");
          }}
          onImageDrop={handleImageDrop}
        />
      </div>

      <Dialog open={!!pendingText} onOpenChange={(open) => !open && setPendingText(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add text</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pendingText && textDraft.trim()) {
                const el: WhiteboardElement = {
                  id: crypto.randomUUID(),
                  type: "text",
                  x: pendingText.x,
                  y: pendingText.y,
                  width: 200,
                  height: 30,
                  color,
                  strokeWidth,
                  text: textDraft,
                  fontSize: 20,
                };
                commitElements([...activePage.elements, el]);
                setPendingText(null);
              }
            }}
            placeholder="Type your text..."
            data-testid="input-text-element"
          />
        </DialogContent>
      </Dialog>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="w-80 p-0">
          <SheetHeader className="border-b border-card-border p-4">
            <SheetTitle>Board chat</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-64px)]">
            <ChatPanel messages={chatMessages} onSend={sendChat} currentUserId={user?.id} />
          </div>
        </SheetContent>
      </Sheet>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} boardId={boardId} />
    </div>
  );
}

function EditableBoardName({ name, readOnly, onRename }: { name: string; readOnly: boolean; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  useEffect(() => setValue(name), [name]);

  if (readOnly) return <span className="truncate font-semibold">{name}</span>;

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-8 w-56"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (value.trim() && value !== name) onRename(value.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        data-testid="input-rename-board"
      />
    );
  }

  return (
    <button className="truncate rounded px-1.5 py-0.5 text-left font-semibold hover-elevate active-elevate-2" onClick={() => setEditing(true)} data-testid="button-edit-name">
      {name}
    </button>
  );
}

function ShareDialog({ open, onOpenChange, boardId }: { open: boolean; onOpenChange: (v: boolean) => void; boardId: string }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const { data: collaborators } = useListCollaborators(boardId, {
    query: { queryKey: getListCollaboratorsQueryKey(boardId), enabled: open },
  });
  const { data: results } = useSearchUsers(
    { q: query },
    { query: { queryKey: getSearchUsersQueryKey({ q: query }), enabled: query.length > 1 } },
  );

  const addCollaborator = useAddCollaborator({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey(boardId) });
        toast.success("Collaborator added");
        setQuery("");
      },
      onError: () => toast.error("Could not add collaborator"),
    },
  });
  const updateRole = useUpdateCollaboratorRole({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey(boardId) }),
    },
  });
  const removeCollaborator = useRemoveCollaborator({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey(boardId) }),
    },
  });

  const shareLink = `${window.location.origin}${import.meta.env.BASE_URL}board/${boardId}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share this board</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input readOnly value={shareLink} className="text-xs" data-testid="input-share-link" />
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(shareLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            data-testid="button-copy-link"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="space-y-2">
          <Input
            placeholder="Search people by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="input-search-users"
          />
          {results && results.length > 0 && (
            <div className="max-h-32 overflow-auto rounded-md border border-card-border">
              {results.map((u) => (
                <button
                  key={u.id}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover-elevate active-elevate-2"
                  onClick={() => addCollaborator.mutate({ id: boardId, data: { userId: u.id, role: "editor" } })}
                  data-testid={`option-user-${u.id}`}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>{(u.firstName ?? u.email ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{u.firstName ?? u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <ScrollArea className="max-h-56">
          <div className="space-y-2 pr-3">
            {collaborators?.map((c) => (
              <div key={c.userId} className="flex items-center justify-between gap-2 rounded-md border border-card-border p-2">
                <div className="flex items-center gap-2 truncate">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{(c.name ?? c.email ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{c.name ?? c.email}</span>
                </div>
                {c.role === "owner" ? (
                  <span className="text-xs text-muted-foreground">Owner</span>
                ) : (
                  <div className="flex items-center gap-1">
                    <Select value={c.role} onValueChange={(role) => updateRole.mutate({ id: boardId, userId: c.userId, data: { role: role as "editor" | "viewer" } })}>
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => removeCollaborator.mutate({ id: boardId, userId: c.userId })}
                      data-testid={`button-remove-${c.userId}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
