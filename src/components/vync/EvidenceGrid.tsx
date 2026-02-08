import { motion } from "framer-motion";
import {
  FileText,
  Layers,
  Clock,
  AlertTriangle,
  Eye,
  TrendingUp,
  BarChart3,
  Cpu,
} from "lucide-react";
import type { CriticalPoint, SummaryMetric } from "@/types/analysis";

const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Total Frames": Layers,
  "Objects Tracked": Eye,
  "Objects": Eye,
  Anomalies: AlertTriangle,
  "Scene Segments": BarChart3,
  "Scenes": BarChart3,
  "Avg Confidence": TrendingUp,
  "Confidence": TrendingUp,
  "Processing Time": Cpu,
  "Duration": Clock,
};
const DEFAULT_METRIC_ICON = BarChart3;

export interface DiagramDataItem {
  time_seconds: number;
  label: string;
  description: string;
}

interface EvidenceGridProps {
  criticalPoints?: CriticalPoint[];
  summaryMetrics?: SummaryMetric[];
  diagramData?: DiagramDataItem[];
}

const EvidenceGrid = ({ criticalPoints = [], summaryMetrics = [], diagramData = [] }: EvidenceGridProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="space-y-6"
    >
      <div className="glass rounded-xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Structural Summary
          </h3>
        </div>
        {summaryMetrics.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground py-2">
            Run analysis to see metrics.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {summaryMetrics.map((metric, i) => {
              const Icon = METRIC_ICONS[metric.label] ?? DEFAULT_METRIC_ICON;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.05, duration: 0.3 }}
                  className="glass-elevated rounded-lg p-3 text-center"
                >
                  <Icon className="mx-auto mb-2 h-4 w-4 text-primary/60" />
                  <div className="font-mono text-lg font-bold text-foreground">
                    {metric.value}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {metric.label}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" />
          <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Visual Synthesis Lab
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="glass-elevated rounded-lg p-4 flex flex-col relative overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-primary/60" />
              <h4 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Temporal Flow Diagram
              </h4>
            </div>
            {diagramData.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground py-2">AI-Generated Diagram</p>
            ) : (
              <ul className="space-y-2 font-mono text-xs">
                {diagramData.map((d, i) => (
                  <li key={i} className="flex gap-2 items-start border-b border-border/50 pb-2 last:border-0">
                    <span className="text-muted-foreground shrink-0 tabular-nums">{Math.floor(d.time_seconds / 60)}:{String(d.time_seconds % 60).padStart(2, "0")}</span>
                    <span className="font-medium text-foreground">{d.label}</span>
                    {d.description && <span className="text-muted-foreground">— {d.description}</span>}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="glass-elevated rounded-lg aspect-[16/9] flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
          >
            <div
              className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity"
              style={{
                backgroundImage: `
                  linear-gradient(hsl(var(--primary) / 0.5) 1px, transparent 1px),
                  linear-gradient(90deg, hsl(var(--primary) / 0.5) 1px, transparent 1px)
                `,
                backgroundSize: "30px 30px",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
                <Eye className="h-5 w-5 text-primary/60" />
              </div>
              <p className="font-mono text-sm font-medium text-foreground/70">Spatial Attention Map</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">AI-Generated Diagram</p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Timestamped Intelligence
          </h3>
        </div>
        {criticalPoints.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground py-2">
            Run analysis to see timestamped insights.
          </p>
        ) : (
          <div className="space-y-3">
            {criticalPoints.map((point, i) => {
              const severityStyles =
                point.severity === "critical"
                  ? "border-destructive/30 bg-destructive/5"
                  : point.severity === "warning"
                  ? "border-accent/30 bg-accent/5"
                  : "border-border bg-card/50";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.1, duration: 0.3 }}
                  className={`flex gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30 ${severityStyles}`}
                >
                  <div className="hidden sm:flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-background/60 border border-border overflow-hidden">
                    <div className="text-center">
                      <div className="font-mono text-lg font-bold text-primary/40">
                        F{point.frame}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground">
                        {point.time}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-primary sm:hidden">
                        {point.time}
                      </span>
                      <h4 className="font-mono text-sm font-semibold text-foreground">
                        {point.title}
                      </h4>
                      {point.severity === "critical" && (
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                      {point.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default EvidenceGrid;
