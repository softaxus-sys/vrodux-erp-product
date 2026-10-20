import * as React from "react";
import { useTranslation } from "react-i18next";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVideoGuides } from "@/hooks/support/use-video-guides";
import { VideoPlayerDialog } from "./video-player-dialog";

/**
 * A small "Watch the guide" link that opens the player for one guide, picked by `slug`, or by the app
 * `module` key when there is no slug. Renders nothing while the manifest is loading, if it failed, or if
 * there is no matching guide — a contextual hint must never show an error or a dead link.
 */
export function WatchGuideLink({ slug, module, className, label }: {
  slug?: string;
  module?: string;
  className?: string;
  label?: string;
}) {
  const { t } = useTranslation("support");
  const { data } = useVideoGuides();
  const [open, setOpen] = React.useState(false);

  const guide = React.useMemo(
    () => data?.find((g) => (slug ? g.slug === slug : !!module && g.module === module)) ?? null,
    [data, slug, module],
  );
  if (!guide) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline", className)}
      >
        <PlayCircle className="h-3.5 w-3.5" />
        {label ?? t("videos.watch")}
      </button>
      <VideoPlayerDialog guide={open ? guide : null} onClose={() => setOpen(false)} />
    </>
  );
}
