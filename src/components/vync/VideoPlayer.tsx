import { motion } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize,
  Settings,
  Layers,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface VideoPlayerProps {
  src: string | null;
}

const VideoPlayer = ({ src }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!src) return;
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const onTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };
  const onLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasVideo = !!src;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const seek = (delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + delta));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * duration;
  };

  if (!hasVideo) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl aspect-video flex items-center justify-center text-muted-foreground font-mono text-sm"
      >
        No video loaded
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
      className="glass rounded-xl overflow-hidden"
    >
      <div className="relative aspect-video bg-background/80 overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
        />
        <div className="absolute top-4 right-4 font-mono text-xs text-muted-foreground bg-black/50 px-2 py-1 rounded">
          Frame {Math.floor(currentTime * 30)} | {formatTime(currentTime)}
        </div>
        {!isPlaying && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center z-10"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full glass glow-cyan">
              <Play className="h-6 w-6 text-primary ml-1" />
            </div>
          </motion.button>
        )}
      </div>

      <div className="border-t border-border bg-card/80 px-4 py-3">
        <div className="group mb-3 cursor-pointer" onClick={handleProgressClick}>
          <div className="relative h-1 rounded-full bg-muted overflow-hidden group-hover:h-1.5 transition-all">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/70"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity glow-cyan"
              style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              onClick={() => seek(-10)}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={togglePlay}
              className="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              onClick={() => seek(10)}
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted">
              <Layers className="h-4 w-4" />
            </button>
            <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted">
              <Volume2 className="h-4 w-4" />
            </button>
            <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted">
              <Settings className="h-4 w-4" />
            </button>
            <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VideoPlayer;
