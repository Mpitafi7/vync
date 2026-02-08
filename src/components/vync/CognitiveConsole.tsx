import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Terminal, Brain, ChevronRight } from "lucide-react";
import type { LogEntry } from "@/types/analysis";

interface CognitiveConsoleProps {
  logs?: LogEntry[];
}

const CognitiveConsole = ({ logs = [] }: CognitiveConsoleProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [logs.length]);

  const getTypeStyles = (type: LogEntry["type"]) => {
    switch (type) {
      case "system":
        return { label: "System", color: "text-primary" };
      case "reasoning":
        return { label: "Reasoning", color: "text-accent" };
      case "status":
        return { label: "Status", color: "text-[hsl(var(--success))]" };
      case "warning":
        return { label: "Warning", color: "text-destructive" };
      case "data":
        return { label: "Data", color: "text-muted-foreground" };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="flex h-full flex-col rounded-xl border glow-border-cyan overflow-hidden"
      style={{ backgroundColor: "hsl(var(--terminal-bg))" }}
    >
      <div className="flex items-center gap-2 border-b border-[hsl(var(--terminal-border)/0.3)] bg-[hsl(var(--terminal-bg))] px-4 py-3">
        <Terminal className="h-4 w-4 text-primary" />
        <span className="font-mono text-xs font-semibold tracking-wider text-primary">
          COGNITIVE TRACE
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="font-mono text-[10px] text-muted-foreground">
            {logs.length ? "LIVE" : "IDLE"}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 scrollbar-thin">
        <div className="space-y-1">
          {logs.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground py-4">
              Run &quot;Initiate Deep Scan&quot; to see analysis logs.
            </p>
          ) : (
            logs.map((log, i) => {
              const style = getTypeStyles(log.type);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="group flex items-start gap-2 rounded px-2 py-1 hover:bg-[hsl(var(--primary)/0.03)] transition-colors"
                >
                  <span className="mt-0.5 font-mono text-[10px] text-muted-foreground/50 shrink-0">
                    {log.timestamp}
                  </span>
                  <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/30" />
                  <div className="min-w-0">
                    <span className={`font-mono text-[10px] font-semibold ${style.color}`}>
                      [{style.label}]
                    </span>
                    <span className="ml-1.5 font-mono text-xs text-foreground/80">
                      {log.message}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
          <div className="flex items-center gap-2 px-2 py-1">
            <Brain className="h-3 w-3 text-primary animate-pulse-glow" />
            <span className="font-mono text-xs text-primary">
              _<span className="animate-terminal-blink">▊</span>
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-[hsl(var(--terminal-border)/0.3)] bg-[hsl(var(--terminal-bg))] px-4 py-2">
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>Logs: {logs.length}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default CognitiveConsole;
