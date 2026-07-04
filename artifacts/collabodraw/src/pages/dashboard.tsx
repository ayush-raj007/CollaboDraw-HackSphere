import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBoards,
  useCreateBoard,
  useDeleteBoard,
  getListBoardsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PenLine, Plus, Trash2, Users, LogOut, PenTool } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: boards, isLoading } = useListBoards();
  const [newName, setNewName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const createBoard = useCreateBoard({
    mutation: {
      onSuccess: (board) => {
        queryClient.invalidateQueries({ queryKey: getListBoardsQueryKey() });
        setCreateOpen(false);
        setNewName("");
        navigate(`/board/${board.id}`);
      },
      onError: () => toast.error("Could not create board"),
    },
  });

  const deleteBoard = useDeleteBoard({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBoardsQueryKey() });
        toast.success("Board deleted");
      },
      onError: () => toast.error("Could not delete board"),
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-card-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <PenTool className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">CollaboDraw</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{(user.firstName ?? user.email ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {user.firstName ?? user.email}
                </span>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={logout} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your boards</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create a board and invite others to draw together in real time.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-board">
                <Plus className="mr-1.5 h-4 w-4" /> New board
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Name your board</DialogTitle>
              </DialogHeader>
              <Input
                autoFocus
                placeholder="e.g. Sprint planning"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) createBoard.mutate({ data: { name: newName.trim() } });
                }}
                data-testid="input-board-name"
              />
              <DialogFooter>
                <Button
                  disabled={!newName.trim() || createBoard.isPending}
                  onClick={() => createBoard.mutate({ data: { name: newName.trim() } })}
                  data-testid="button-create-board"
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading boards...</p>}

        {!isLoading && (!boards || boards.length === 0) && (
          <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
            <PenLine className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No boards yet. Create your first one to start drawing.</p>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards?.map((board) => (
            <Card key={board.id} className="group flex flex-col hover-elevate" data-testid={`card-board-${board.id}`}>
              <CardHeader className="cursor-pointer" onClick={() => navigate(`/board/${board.id}`)}>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-1 text-base">{board.name}</CardTitle>
                  <Badge variant={board.role === "owner" ? "default" : "secondary"} className="shrink-0 capitalize">
                    {board.role}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 cursor-pointer" onClick={() => navigate(`/board/${board.id}`)}>
                <p className="text-xs text-muted-foreground">
                  Owner: {board.ownerName ?? "Unknown"} · Updated {new Date(board.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {board.collaboratorCount ?? 0}
                </span>
                {board.role === "owner" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} data-testid={`button-delete-${board.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{board.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>This permanently removes the board for everyone with access.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteBoard.mutate({ id: board.id })}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
