/**
 * VideoUpload — Public bucket "videos" (lowercase), no auth.
 * Max 50MB (Vync Community Edition / Supabase Free Tier).
 */
import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, Infinity as InfinityIcon, Zap, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const BUCKET = "videos";
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB — Vync Community Edition (Free Tier)

const isVideoType = (file: File) => /^video\//.test(file.type);
const isWithinSizeLimit = (file: File) => file.size <= MAX_FILE_BYTES;
const acceptVideo = (file: File) => isVideoType(file) && isWithinSizeLimit(file);

/** Sanitize file name: no spaces/special chars that break Storage URL */
function sanitizeFileName(name: string): string {
  const base = name.replace(/\s+/g, "_").replace(/[#?%&<>"']/g, "");
  const lastDot = base.lastIndexOf(".");
  const stem = lastDot > 0 ? base.slice(0, lastDot) : base;
  const ext = lastDot > 0 ? base.slice(lastDot) : "";
  return stem.slice(0, 80) + ext;
}

/** Simple path: uploads/{timestamp}-{sanitized-name} */
function getStoragePath(file: File): string {
  const safeName = sanitizeFileName(file.name) || "video";
  return `uploads/${Date.now()}-${safeName}`;
}

export interface UploadResult {
  videoId: string;
  storagePath: string;
  publicUrl: string;
}

interface VideoUploadProps {
  onUploadComplete: (result: UploadResult) => void;
}

export function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runUpload = useCallback(
    async (file: File) => {
      setErrorMessage(null);
      if (!isVideoType(file)) {
        toast.error("Invalid file. Use a video (e.g. MP4, MOV).");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErrorMessage(
          "Vync Community Edition Limit: To ensure stability on our free tier, please upload videos under 50MB. High-resolution files can be compressed at videocandy.com."
        );
        return;
      }
      setUploading(true);
      setProgress(0);
      try {
        const filePath = getStoragePath(file);

        // 1) Upload to Storage first — webhook will run after insert, so file must exist
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type || "video/mp4",
          });

        if (uploadError) {
          const errPayload = {
            message: uploadError.message,
            name: (uploadError as { name?: string }).name,
            statusCode: (uploadError as { statusCode?: string }).statusCode,
            error: (uploadError as { error?: string }).error,
          };
          console.error("FULL STORAGE ERROR:", JSON.stringify(errPayload, null, 2));
          toast.error(`Upload failed: ${uploadError.message}. Check console (F12) for details.`);
          throw new Error(uploadError.message);
        }
        setProgress(50);

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;

        // 2) Insert row — Database Webhook fires and calls analysis_trigger Edge Function
        const { data: row, error: insertError } = await supabase
          .from("videos")
          .insert({
            storage_path: filePath,
            file_name: file.name ?? "video",
            status: "processing",
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("FULL DB INSERT ERROR:", JSON.stringify(insertError, null, 2));
          toast.error(`DB error: ${insertError.message}`);
          throw insertError;
        }
        if (!row?.id) throw new Error("No video id returned");
        setProgress(100);

        onUploadComplete({ videoId: row.id, storagePath: filePath, publicUrl });
        toast.success("Video uploaded. Analysis will appear via Realtime.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        if (!msg.includes("Upload failed:")) {
          console.error("UPLOAD ERROR:", err);
        }
        toast.error(msg);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [onUploadComplete]
  );

  const handleFileSelect = useCallback(
    (file: File | null) => {
      if (!file) return;
      setErrorMessage(null);
      if (!isVideoType(file)) {
        toast.error("Invalid file. Use a video (e.g. MP4, MOV).");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErrorMessage(
          "Vync Community Edition Limit: To ensure stability on our free tier, please upload videos under 50MB. High-resolution files can be compressed at videocandy.com."
        );
        return;
      }
      runUpload(file);
    },
    [runUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      e.target.value = "";
    },
    [handleFileSelect]
  );

  const isOverLimit = !!errorMessage;
  const dropZoneDisabled = uploading || isOverLimit;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="absolute top-4 left-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>

      <input
        id="vync-file-input"
        type="file"
        accept="video/*"
        onChange={handleInputChange}
        className="hidden"
        disabled={uploading}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl"
      >
        <motion.div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <img src="/logo.png" alt="Vync" className="h-14 w-auto" />
          </div>
          <p className="font-mono text-sm tracking-widest text-muted-foreground">
            MULTIMODAL VIDEO INTELLIGENCE ENGINE
          </p>
        </motion.div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="font-mono text-sm text-amber-200/95">⚠️ {errorMessage}</p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  Tip: Compress your video at{" "}
                  <a
                    href="https://videocandy.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    VideoCandy
                  </a>{" "}
                  to stay under the limit.
                </p>
              </div>
            </div>
          </div>
        )}

        <motion.div
          onDragOver={(e) => { e.preventDefault(); if (!dropZoneDisabled) setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !dropZoneDisabled && document.getElementById("vync-file-input")?.click()}
          className={`group relative overflow-hidden rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-500 ${
            dropZoneDisabled
              ? "cursor-not-allowed border-muted bg-muted/30 opacity-70"
              : isDragging
              ? "cursor-pointer border-primary bg-primary/5"
              : "cursor-pointer border-border hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
          {uploading ? (
            <div className="relative space-y-4">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <p className="font-mono text-sm text-foreground">Uploading to storage…</p>
              <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="relative mb-8 flex justify-center">
                <div className="relative h-32 w-32 rounded-full border border-primary/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <InfinityIcon className="h-12 w-12 text-primary animate-pulse-glow" />
                </div>
              </div>
              <Upload className="mx-auto mb-4 h-6 w-6 text-muted-foreground group-hover:text-primary" />
              <h2 className="mb-2 text-xl font-semibold text-foreground">Upload video for analysis</h2>
              <p className="mb-6 text-sm text-muted-foreground">Drop file here or click to browse (max 50MB)</p>
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-primary" /> MP4, MOV, AVI</span>
                <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-primary" /> Up to 50MB</span>
              </div>
            </>
          )}
        </motion.div>

        <motion.div className="mt-8 flex items-center justify-center gap-8 font-mono text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))] animate-pulse-glow" />
            SYSTEM ONLINE
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
            GEMINI 3 + SUPABASE
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
