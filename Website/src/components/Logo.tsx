import { LOGO_SRC, LOGO_SRC_DARK, LOGO_WIDTH } from "@/lib/brand";

/**
 * Renders the client's logo when one has been supplied, and a typeset wordmark
 * until then — so the site never shows a broken image while waiting on assets.
 */
export function Logo({
  name,
  tagline,
  variant = "light",
}: {
  name: string;
  tagline?: string;
  variant?: "light" | "dark";
}) {
  const src = variant === "dark" ? (LOGO_SRC_DARK ?? LOGO_SRC) : LOGO_SRC;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={LOGO_WIDTH}
        className="h-auto"
        style={{ width: LOGO_WIDTH }}
      />
    );
  }

  return (
    <span className="flex flex-col leading-none">
      <span
        className={`font-display text-xl tracking-tight sm:text-2xl ${
          variant === "dark" ? "text-ink-50" : "text-ink-900"
        }`}
      >
        {name}
      </span>
      {tagline && (
        <span
          className={`mt-1 text-[0.6rem] uppercase tracking-widest ${
            variant === "dark" ? "text-ink-500" : "text-ink-400"
          }`}
        >
          {tagline}
        </span>
      )}
    </span>
  );
}
