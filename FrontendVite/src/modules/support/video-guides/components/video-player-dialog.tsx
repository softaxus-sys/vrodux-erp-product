import * as React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, PlayCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration, type VideoGuide } from "@/lib/support/video-guides.api";

/**
 * Plays one guide. The chapters list seeks on click and follows playback. Nothing is persisted:
 * closing the dialog unmounts the <video>, so there is no resume position, watch history or tracking.
 */
export function VideoPlayerDialog({ guide, onClose }: { guide: VideoGuide | null; onClose: () => void }) {
  return (
    <Dialog open={!!guide} onOpenChange={(open) => { if (!open) onClose(); }}>
      {guide && (
        <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">
          <Player key={guide.slug} guide={guide} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function Player({ guide }: { guide: VideoGuide }) {
  const { t } = useTranslation("support");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [now, setNow] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  // The chapter being played = the last one that has started.
  const active = React.useMemo(() => {
    let idx = -1;
    guide.chapters.forEach((c, i) => { if (now >= c.start - 0.25) idx = i; });
    return idx;
  }, [guide.chapters, now]);

  const seek = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
    void v.play().catch(() => { /* autoplay can be refused; the controls are right there */ });
  };

  return (
    <>
      <div className="px-5 pt-5 pb-3 pe-12">
        <DialogTitle className="text-base font-semibold leading-snug">{guide.title}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">{guide.description}</DialogDescription>
      </div>

      <div className="bg-black">
        {failed ? (
          <div className="aspect-video flex flex-col items-center justify-center gap-3 text-center text-white p-6">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="text-sm">{t("videos.playerError")}</p>
            <Button size="sm" variant="secondary" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>
              {t("videos.retry")}
            </Button>
          </div>
        ) : (
          <video
            key={attempt}
            ref={videoRef}
            className="w-full aspect-video bg-black"
            controls
            playsInline
            preload="metadata"
            poster={guide.posterUrl || undefined}
            src={guide.videoUrl}
            onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
            onSeeked={(e) => setNow(e.currentTarget.currentTime)}
            onError={() => setFailed(true)}
          />
        )}
      </div>

      {guide.chapters.length > 1 && (
        <div className="px-5 py-4 overflow-y-auto min-h-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("videos.chapters")}</p>
          <ol className="grid gap-1 sm:grid-cols-2">
            {guide.chapters.map((c, i) => (
              <li key={`${c.start}-${i}`}>
                <button
                  type="button"
                  onClick={() => seek(c.start)}
                  aria-current={i === active ? "true" : undefined}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors",
                    i === active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground",
                  )}
                >
                  <PlayCircle className={cn("h-4 w-4 shrink-0", i === active ? "text-primary" : "text-muted-foreground")} />
                  <span className="flex-1 truncate">{c.title}</span>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">{formatDuration(c.start)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
