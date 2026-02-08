import { motion } from "framer-motion";
import { Activity, ChevronLeft } from "lucide-react";

interface DashboardHeaderProps {
  onBack: () => void;
}

const DashboardHeader = ({ onBack }: DashboardHeaderProps) => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-xl px-6 py-3"
    >
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="font-mono text-xs">Back</span>
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Vync" className="h-8 w-auto" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 rounded-full glass px-3 py-1">
          <Activity className="h-3 w-3 text-[hsl(var(--success))]" />
          <span className="font-mono text-[10px] text-muted-foreground">
            Processing: <span className="text-[hsl(var(--success))]">Active</span>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-full glass px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
          <span className="font-mono text-[10px] text-muted-foreground">
            AI Core: <span className="text-primary">Online</span>
          </span>
        </div>
      </div>
    </motion.header>
  );
};

export default DashboardHeader;
