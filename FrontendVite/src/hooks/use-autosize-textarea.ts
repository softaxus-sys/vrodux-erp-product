import * as React from "react";

/**
 * Auto-grows a textarea to fit its content (the ChatGPT-style composer), up to `maxHeight` px,
 * then lets it scroll internally instead of growing further.
 *
 * Without this, a plain `rows={1}` textarea stays pinned at one line's height no matter what's
 * typed or pasted into it — multi-line content is still there, just scrolled out of view below the
 * visible line. That reads as "the paste didn't work" until the cursor is moved (e.g. pressing the
 * up arrow), which scrolls the box and reveals the text was there all along.
 */
export function useAutosizeTextarea(value: string, maxHeight = 200) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);

  return ref;
}
