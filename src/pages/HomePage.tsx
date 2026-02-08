import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Clock, Layers, Zap, AlertTriangle } from "lucide-react";

const features = [
  {
    title: "Deep Analysis",
    description: "Frame-by-frame visual reasoning.",
    icon: Brain,
  },
  {
    title: "Temporal Logic",
    description: "Precise timestamped insights.",
    icon: Clock,
  },
  {
    title: "Multimodal Output",
    description: "AI-generated 4K diagrams and summaries.",
    icon: Layers,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-20 pb-24">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--primary) / 0.4) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--primary) / 0.4) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto max-w-4xl text-center"
        >
          <div className="mb-6 flex justify-center">
            <img src="/logo.png" alt="Vync" className="h-16 w-auto" />
          </div>
          <h1 className="font-bold tracking-tight text-4xl sm:text-5xl md:text-6xl text-foreground mb-4">
            Vync: Multimodal Video Intelligence
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Deep frame-by-frame visual reasoning powered by Gemini 3.
          </p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Link
              to="/analyzer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30"
            >
              <Zap className="h-5 w-5" />
              Launch Analyzer
            </Link>
          </motion.div>

          {/* 50MB limit warning — prominent */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mx-auto mt-10 max-w-xl rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3"
          >
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="font-mono text-sm text-amber-200/95">
                  ⚠️ Vync Community Edition: Please upload videos under <strong>50MB</strong> for analysis.
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  Compress high-resolution files at{" "}
                  <a
                    href="https://videocandy.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    videocandy.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Features - Glassmorphic cards */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase text-center mb-10">
            Capabilities
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.4 }}
                  className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 shadow-xl"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">{f.title}</h3>
                  <p className="font-mono text-sm text-muted-foreground">{f.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tech Showcase — Cyber-Industrial */}
      <section className="px-6 py-16 border-t border-border/40">
        <h2 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase text-center mb-8">
          Tech Stack
        </h2>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl flex flex-wrap items-center justify-center gap-6 text-center"
        >
          <span className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 font-mono text-sm text-primary">
            Gemini 3 High-Reasoning
          </span>
          <span className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 font-mono text-sm text-primary">
            Supabase Realtime
          </span>
          <span className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 font-mono text-sm text-primary">
            Edge Functions
          </span>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <Link
            to="/analyzer"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-6 py-3 font-mono text-sm text-primary transition-colors hover:bg-primary/10"
          >
            Launch Analyzer
          </Link>
        </div>
      </section>
    </div>
  );
}
