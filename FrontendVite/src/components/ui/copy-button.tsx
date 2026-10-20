import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small "copy to clipboard" icon. Click copies `value`, then shows a tick for a moment so the person
 * knows it worked. It never navigates or opens the row it sits in (it stops the click), so it is safe
 * inside clickable cards and table rows. Renders nothing when there is nothing to copy.
 */
export function CopyButton({ value, label, className }: { value?: string | null; label: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!value) return null;

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API is blocked on non-secure origins and some embedded browsers: fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = value; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 1500);
  };

  return (
    <button type="button" onClick={copy} title={done ? "Copied" : label} aria-label={done ? "Copied" : label}
      className={cn("inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-primary hover:bg-muted/60 shrink-0 transition-colors", done && "text-success", className)}>
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
