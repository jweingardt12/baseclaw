import { useState, useRef, useEffect } from "react";
import { Dialog, DialogTitle, DialogBody } from "@/catalyst/dialog";
import { Button } from "@/catalyst/button";
import { Badge } from "@/catalyst/badge";
import { Textarea } from "@/catalyst/textarea";
import { Loader2, Send } from "lucide-react";
import { postChat } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
}

const quickPrompts = [
  "Who should I start today?",
  "Any waiver wire targets?",
  "Analyze my matchup",
  "Roster advice",
];

export function ChatPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<{ controller: AbortController; promise: Promise<void> } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend(text?: string) {
    const msg = text || input.trim();
    if (!msg || streaming) return;
    setInput("");
    const userMsg: Message = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "", toolCalls: [] };
    setMessages((prev) => [...prev, assistantMsg]);

    abortRef.current = postChat(
      msg,
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") last.content += chunk;
          return updated;
        });
      },
      (tool) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") last.toolCalls = [...(last.toolCalls || []), tool];
          return updated;
        });
      }
    );

    setTimeout(() => setStreaming(false), 30000);
  }

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} size="lg">
      <DialogTitle>BaseClaw Chat</DialogTitle>
      <DialogBody>
        <div className="flex flex-col gap-3 h-[60vh]">
          <div className="flex-1 overflow-y-auto space-y-3 pr-2" ref={scrollRef}>
            {messages.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                Ask me anything about your fantasy team.
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white"
                  }`}
                >
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {msg.toolCalls.map((tool, j) => (
                        <Badge key={j} color="zinc" className="text-[10px]">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">
                    {msg.content || (streaming && msg.role === "assistant" ? "..." : "")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 pb-1">
            {quickPrompts.map((p) => (
              <Button key={p} outline className="text-xs !px-2 !py-1" onClick={() => handleSend(p)}>
                {p}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
              placeholder="Ask about your team..."
              className="min-h-[40px] max-h-[120px] resize-none flex-1"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              color="blue"
              onClick={() => handleSend()}
              disabled={streaming || !input.trim()}
              className="self-end"
            >
              {streaming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogBody>
    </Dialog>
  );
}
