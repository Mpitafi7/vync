import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface VideoChatProps {
  videoId: string;
  open: boolean;
  onClose: () => void;
}

export function VideoChat({ videoId, open, onClose }: VideoChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || thinking || !videoId) return;

    setInput("");
    setError(null);
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setThinking(true);

    try {
      const { data: analysis, error: fetchErr } = await supabase
        .from("video_analyses")
        .select("summary, thought_trace")
        .eq("video_id", videoId)
        .maybeSingle();

      if (fetchErr) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: "Could not load video analysis. Please try again." },
        ]);
        setThinking(false);
        return;
      }

      const summary = typeof analysis?.summary === "string" ? analysis.summary : "";
      const thought_trace = Array.isArray(analysis?.thought_trace) ? analysis.thought_trace : [];

      const { data: fnData, error: fnErr } = await supabase.functions.invoke("chat_with_video", {
        body: { question: text, summary, thought_trace },
      });

      if (fnErr) {
        setError(fnErr.message);
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: "Chat service error. Please try again." },
        ]);
        setThinking(false);
        return;
      }

      const reply = typeof fnData?.reply === "string" ? fnData.reply : "I couldn't generate a reply.";
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex h-full w-full flex-col overflow-hidden"
        style={{ backgroundColor: "hsl(var(--terminal-bg))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--terminal-border)/0.3)] px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs font-semibold tracking-wider text-primary">
              AI VIDEO CHAT
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 scrollbar-thin"
        >
          {messages.length === 0 && !thinking && (
            <p className="font-mono text-xs text-muted-foreground py-4">
              Ask anything about this video. Answers are based on the analysis summary and thought trace.
            </p>
          )}
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-lg px-3 py-2 font-mono text-xs ${
                m.role === "user"
                  ? "ml-6 bg-primary/15 text-primary border border-primary/30"
                  : "mr-6 bg-white/5 text-foreground/90 border border-white/10"
              }`}
            >
              {m.content}
            </motion.div>
          ))}
          {thinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mr-6 flex items-center gap-2 rounded-lg px-3 py-2 bg-white/5 border border-white/10 font-mono text-xs text-muted-foreground"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>Vync AI is thinking...</span>
            </motion.div>
          )}
          {error && (
            <p className="font-mono text-[10px] text-destructive">{error}</p>
          )}
        </div>

        {/* Sticky input */}
        <div className="p-3 border-t border-[hsl(var(--terminal-border)/0.3)] shrink-0 bg-[hsl(var(--terminal-bg))]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this video..."
              disabled={thinking}
              className="flex-1 rounded-lg border border-[hsl(var(--terminal-border)/0.5)] bg-black/30 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              type="submit"
              disabled={thinking || !input.trim()}
              className="shrink-0 rounded-lg bg-primary/20 text-primary border border-primary/40 p-2 hover:bg-primary/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
