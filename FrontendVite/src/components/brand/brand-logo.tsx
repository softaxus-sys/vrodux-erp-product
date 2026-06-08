import * as React from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Reactively tracks whether the app is in dark mode (`.dark` on <html>). */
function useIsDark(): boolean {
  const [dark, setDark] = React.useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  React.useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/**
 * Vrodux brand. Renders the official logo image from /vrodux-logo.png.
 * If the asset is missing it gracefully falls back to the gradient mark + wordmark,
 * so the app always shows branding.
 *
 *   Place the logo file at:  FrontendVite/public/vrodux-logo.png
 */
const LOGO_SRC = "/vrodux-logo.png";

/** Small square brand mark (for collapsed rails / tight spaces). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg", className)}
      style={{
        background: "linear-gradient(135deg, #2563eb, #1e3a8a)",
        boxShadow: "0 0 12px rgba(37,99,235,0.4)",
      }}
    >
      <span className="text-white font-extrabold text-base leading-none">V</span>
    </div>
  );
}

/**
 * Full brand lockup: the Vrodux logo image, with an icon+wordmark fallback.
 * @param subtitle optional small line under the wordmark (fallback only)
 * @param height   pixel height of the logo image (default 28)
 */
export function BrandLogo({
  className,
  subtitle = "ERP Solution",
  height = 28,
  plate = false,
}: {
  className?: string;
  subtitle?: string;
  height?: number;
  /** Wrap the logo in a white rounded chip so its colors read on dark/colored surfaces. */
  plate?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const isDark = useIsDark();

  if (!failed) {
    const img = (
      <img
        src={LOGO_SRC}
        alt="Vrodux ERP"
        onError={() => setFailed(true)}
        style={{ height }}
        className={cn("w-auto object-contain select-none", className)}
        draggable={false}
      />
    );
    // Explicit plate, or auto-plate in dark mode so a dark/coloured logo stays legible.
    if (plate || isDark) {
      return (
        <div className="inline-flex items-center rounded-xl bg-white px-3 py-2 shadow-sm">
          {img}
        </div>
      );
    }
    return img;
  }

  // Fallback — mark + wordmark
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
        style={{ background: "linear-gradient(135deg, #2563eb, #1e3a8a)", boxShadow: "0 0 12px rgba(37,99,235,0.4)" }}
      >
        <Zap className="h-4 w-4 text-white" />
      </div>
      <div className="leading-tight">
        <p className="font-extrabold text-[15px] tracking-tight text-foreground">Vrodux</p>
        {subtitle && <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
