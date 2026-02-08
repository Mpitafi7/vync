import { useState } from "react";
import { motion } from "framer-motion";
import { ScanSearch, Image, FileDown, Loader2 } from "lucide-react";

const actions = [
  { id: "scan", label: "Initiate Deep Scan", icon: ScanSearch, variant: "primary" as const },
  { id: "diagram", label: "Generate 4K Diagram", icon: Image, variant: "accent" as const },
  { id: "export", label: "Export Report", icon: FileDown, variant: "secondary" as const },
];

interface ActionDockProps {
  onDeepScan?: () => void;
  scanLoading?: boolean;
}

const ActionDock = ({ onDeepScan, scanLoading = false }: ActionDockProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleClick = (id: string) => {
    if (id === "scan" && onDeepScan) {
      onDeepScan();
      return;
    }
    setLoading(id);
    setTimeout(() => setLoading(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="flex flex-wrap gap-3"
    >
      {actions.map((action, i) => {
        const Icon = action.icon;
        const isLoading = action.id === "scan" ? scanLoading : loading === action.id;
        const variantClasses =
          action.variant === "primary"
            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 glow-cyan"
            : action.variant === "accent"
            ? "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20 glow-amber"
            : "bg-secondary border-border text-secondary-foreground hover:bg-muted";
        return (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleClick(action.id)}
            disabled={isLoading || (action.id === "scan" && !onDeepScan)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-xs font-medium tracking-wide transition-all disabled:opacity-60 ${variantClasses}`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
            {action.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
};

export default ActionDock;
