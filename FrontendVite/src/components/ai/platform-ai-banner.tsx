import * as React from "react";
import { Info, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAiCapabilities } from "@/hooks/ai/use-ai";
import type { PlatformAiNotice } from "@/lib/ai/ai.api";

/**
 * Tracks whether the shared platform AI is answering, starting from what the server says on load and
 * following the notice on each reply. `onReply` is called with every chat response's notice; when the
 * server marks the reply as a good moment to suggest it, a toast offers the "add your own key" action.
 */
export function usePlatformAiNotice(onAddKey?: () => void) {
  const { data: caps } = useAiCapabilities();
  const [latest, setLatest] = React.useState<PlatformAiNotice | null>(null);
  const notice = latest ?? caps?.platformAi ?? null;

  const onReply = React.useCallback((n: PlatformAiNotice | null | undefined) => {
    if (!n) return;
    setLatest(n);
    if (n.suggestOwnKey) {
      toast.info("Want faster, unlimited answers?", {
        description: "You're using Vrodux's shared AI. Adding your own AI key gives you better speed and no monthly limit.",
        duration: 12000,
        ...(onAddKey ? { action: { label: "Add my key", onClick: onAddKey } } : {}),
      });
    }
  }, [onAddKey]);

  return { notice: notice?.usingPlatform ? notice : null, onReply };
}

/** The permanent note at the top of the assistant while a workspace is on the shared AI. */
export function PlatformAiBanner({ notice, onAddKey, compact }: {
  notice: PlatformAiNotice | null;
  /** Present for people allowed to change AI settings; others are told to ask an administrator. */
  onAddKey?: () => void;
  compact?: boolean;
}) {
  if (!notice || !notice.showBanner) return null;

  const left = notice.messageCap > 0 ? Math.max(0, notice.messageCap - notice.messagesUsed) : null;
  const text = notice.limitReached
    ? "You've used this month's shared AI messages."
    : left === null
      ? "You're using Vrodux's shared AI."
      : `You're using Vrodux's shared AI — ${left} of ${notice.messageCap} messages left this month.`;

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-xl border text-xs",
      compact ? "px-3 py-2" : "px-3.5 py-2.5 mb-3",
      notice.limitReached
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300")}>
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">
        {text} Add your own AI key for faster answers and no monthly limit.
        {!onAddKey && " Ask an administrator to add one in Settings."}
      </span>
      {onAddKey && (
        <button type="button" onClick={onAddKey}
          className="inline-flex items-center gap-1 rounded-md bg-background/70 px-2 py-1 font-medium hover:bg-background border border-border/60 shrink-0">
          <KeyRound className="h-3 w-3" />Add my key
        </button>
      )}
    </div>
  );
}
