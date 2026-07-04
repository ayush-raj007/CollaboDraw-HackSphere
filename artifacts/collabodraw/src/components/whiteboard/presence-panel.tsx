import type { PresenceUser } from "@/lib/whiteboard-types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export function PresencePanel({ users, connected }: { users: PresenceUser[]; connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant={connected ? "default" : "secondary"} className="gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-300" : "bg-muted-foreground"}`} />
        {connected ? "Live" : "Offline"}
      </Badge>
      <div className="flex -space-x-2">
        {users.map((u) => (
          <Tooltip key={u.userId}>
            <TooltipTrigger asChild>
              <Avatar className="h-8 w-8 border-2 border-background" style={{ backgroundColor: u.color }}>
                <AvatarFallback style={{ backgroundColor: u.color, color: "white" }}>
                  {u.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{u.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
