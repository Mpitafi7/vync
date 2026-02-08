import { motion } from "framer-motion";
import { Brain, Eye, AlertTriangle, Lightbulb, Activity } from "lucide-react";
import type { TimelineMarker } from "@/types/analysis";

const ICON_MAP = {
  primary: Brain,
  warning: AlertTriangle,
  accent: Lightbulb,
} as const;

const DEFAULT_HEATMAP = Array.from({ length: 60 }, (_, i) => 0.2 + 0.3 * Math.sin((i / 60) * Math.PI * 2));

interface IntelligenceTimelineProps {
  markers?: TimelineMarker[];
  heatmapData?: number[];
}

const IntelligenceTimeline = ({ markers = [], heatmapData = DEFAULT_HEATMAP }: IntelligenceTimelineProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="glass rounded-xl p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Intelligence Timeline
        </h3>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" /> Detection
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-accent" /> Insight
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-destructive" /> Anomaly
          </span>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex h-8 items-end gap-px rounded overflow-hidden">
          {heatmapData.map((value, i) => (
            <motion.div
              key={i}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.4 + i * 0.01, duration: 0.3 }}
              className="flex-1 origin-bottom rounded-t-sm transition-colors"
              style={{
                height: `${Math.min(100, value * 100)}%`,
                backgroundColor:
                  value > 0.7
                    ? `hsl(var(--heatmap-high) / ${0.5 + value * 0.5})`
                    : value > 0.4
                    ? `hsl(var(--heatmap-mid) / ${0.4 + value * 0.4})`
                    : `hsl(var(--heatmap-low) / ${0.3 + value * 0.3})`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        {markers.length === 0 ? (
          <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
            Run analysis to see markers
          </p>
        ) : (
          markers.map((marker, i) => {
            const Icon = ICON_MAP[marker.type] ?? Activity;
            const colorClass =
              marker.type === "primary"
                ? "text-primary bg-primary/10 border-primary/30"
                : marker.type === "warning"
                ? "text-destructive bg-destructive/10 border-destructive/30"
                : "text-accent bg-accent/10 border-accent/30";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.08, duration: 0.3 }}
                className="absolute top-1/2 -translate-y-1/2 group"
                style={{ left: `${(marker.position / 60) * 100}%` }}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border cursor-pointer transition-transform hover:scale-125 ${colorClass}`}
                >
                  <Icon className="h-3 w-3" />
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded bg-card px-2 py-1 font-mono text-[10px] text-foreground border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {marker.label}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};

export default IntelligenceTimeline;
