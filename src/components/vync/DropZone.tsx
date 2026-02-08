import { motion } from "framer-motion";
import { Upload, Infinity as InfinityIcon, Zap } from "lucide-react";
import { useCallback, useState } from "react";

interface DropZoneProps {
  onFileAccepted: (file: File) => void;
}

const acceptVideo = (file: File) =>
  /^video\//.test(file.type) && file.size <= 2 * 1024 * 1024 * 1024; // 2GB

const DropZone = ({ onFileAccepted }: DropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file || !acceptVideo(file)) return;
      onFileAccepted(file);
    },
    [onFileAccepted]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      handleFile(file ?? null);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      handleFile(file ?? null);
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <input
        id="vync-file-input"
        type="file"
        accept="video/*"
        onChange={handleInputChange}
        className="hidden"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-3xl"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-10 text-center"
        >
          <div className="mb-4 flex items-center justify-center">
            <img src="/logo.png" alt="Vync" className="h-14 w-auto" />
          </div>
          <p className="font-mono text-sm tracking-widest text-muted-foreground">
            MULTIMODAL VIDEO INTELLIGENCE ENGINE
          </p>
        </motion.div>

        {/* Drop Zone Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("vync-file-input")?.click()}
          className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-500 ${
            isDragging
              ? "border-primary glow-cyan bg-primary/5"
              : "border-border hover:border-primary/50 hover:glow-cyan"
          }`}
        >
          {/* Animated background grid */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div
              className="h-full w-full"
              style={{
                backgroundImage: `
                  linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
                  linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)
                `,
                backgroundSize: "40px 40px",
              }}
            />
          </div>

          {/* Scan line effect */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-scan-line absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>

          {/* Infinity animation */}
          <div className="relative mb-8 flex justify-center">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="h-32 w-32 rounded-full border border-primary/20"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="absolute inset-2 rounded-full border border-accent/20"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="absolute inset-4 rounded-full border border-primary/30"
              />

              {/* Orbiting dots */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 6 + i * 2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                  delay: i * 0.5,
                  }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div
                    className="h-2 w-2 rounded-full bg-primary animate-pulse-glow"
                    style={{ transform: `translateX(${40 + i * 12}px)` }}
                  />
                </motion.div>
              ))}

              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <InfinityIcon className="h-12 w-12 text-primary animate-pulse-glow" />
              </div>
            </div>
          </div>

          {/* Text */}
          <div className="relative">
            <Upload className="mx-auto mb-4 h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Ingest Video for Analysis
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Drop your video file here or click to browse
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-accent" />
                MP4, MOV, AVI
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-accent" />
                Up to 4K Resolution
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-accent" />
                Max 2GB
              </span>
            </div>
          </div>
        </motion.div>

        {/* Status indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-8 flex items-center justify-center gap-8 font-mono text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))] animate-pulse-glow" />
            SYSTEM ONLINE
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
            AI CORE READY
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-glow" />
            GPU ALLOCATED
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default DropZone;
