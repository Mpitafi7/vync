import { useState, useCallback } from "react";
import { VideoUpload } from "@/components/vync/VideoUpload";
import DashboardHeader from "@/components/vync/DashboardHeader";
import { AnalysisViewWithConsole } from "@/components/vync/AnalysisView";

export interface UploadResult {
  videoId: string;
  storagePath: string;
  publicUrl: string;
}

/**
 * Analyzer dashboard. Upload triggers DB insert → Supabase Database Webhook
 * calls analysis_trigger Edge Function. Frontend only listens to video_analyses
 * via Realtime for results.
 */
const Index = () => {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleUploadComplete = useCallback((result: UploadResult) => {
    setUploadResult(result);
  }, []);

  const handleBack = useCallback(() => {
    setUploadResult(null);
  }, []);

  if (!uploadResult) {
    return <VideoUpload onUploadComplete={handleUploadComplete} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader onBack={handleBack} />

      <div className="flex flex-1 overflow-hidden">
        <AnalysisViewWithConsole
          videoId={uploadResult.videoId}
          publicUrl={uploadResult.publicUrl}
        />
      </div>
    </div>
  );
};

export default Index;
