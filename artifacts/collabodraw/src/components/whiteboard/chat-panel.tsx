import { useEffect, useRef, useState } from "react";
import type { ChatEntry } from "@/lib/whiteboard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendHorizonal } from "lucide-react";

export function ChatPanel({ messages, onSend, currentUserId }: { messages: ChatEntry[]; onSend: (msg: string) => void; currentUserId?: string }) {
  const [value, setValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-2 py-3">
          {messages.length === 0 && <p className="text-center text-xs text-muted-foreground">No messages yet. Say hi!</p>}
          {messages.map((m) => {
            const mine = m.userId === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-muted-foreground">{m.name}</span>
                <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {m.message}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="flex items-center gap-2 border-t border-card-border p-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Message the board..."
          data-testid="input-chat"
        />
        <Button size="icon" onClick={submit} data-testid="button-send-chat">
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
