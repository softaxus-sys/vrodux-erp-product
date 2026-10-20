import * as React from "react";

/** Subscribes to a CSS media query. SSR-safe; starts from the real value so there is no flash. */
export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== "undefined" && window.matchMedia(query).matches;
  const [matches, setMatches] = React.useState(get);
  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Below Tailwind's `lg` (1024px): phones and tablets get the drawer shell. */
export const useIsMobile = () => useMediaQuery("(max-width: 1023px)");
