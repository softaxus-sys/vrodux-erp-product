"use client";

import { useState } from "react";
import { LOGO_SRC, LOGO_SRC_DARK, LOGO_WIDTH } from "@/lib/brand";

/**
 * Renders the client's logo file, falling back to a typeset wordmark if the file
 * is missing or fails to load.
 *
 * The fallback is deliberate rather than defensive dressing: the logo path is
 * configured before the asset is necessarily in place, and a broken-image icon
 * in the header is far worse than clean type while someone chases the file.
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
  const [failed, setFailed] = useState(false);
  const src = variant === "dark" ? (LOGO_SRC_DARK ?? LOGO_SRC) : LOGO_SRC;

  if (src && !failed) {
    return (
      // Plain <img>: the file is served straight from /public, and next/image's
      // optimiser would add a running-server dependency for no benefit here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={LOGO_WIDTH}
        className="h-auto w-auto"
        style={{ maxWidth: LOGO_WIDTH }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="flex flex-col leading-none">
      <span
        className={`font-display text-xl font-bold uppercase tracking-tight sm:text-2xl ${
          variant === "dark" ? "text-white" : "text-ink-800"
        }`}
      >
        {name}
      </span>
      {tagline && (
        <span className="mt-1 text-[0.6rem] uppercase tracking-widest text-brand-500">
          {tagline}
        </span>
      )}
    </span>
  );
}
