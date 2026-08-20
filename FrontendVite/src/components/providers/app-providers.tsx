import * as React from "react";
import { QueryProvider }  from "./query-provider";
import { ThemeProvider }  from "./theme-provider";

// NOTE: <Toaster> deliberately lives in main.tsx OUTSIDE the ErrorBoundary. When it sat here, any
// crash in the app unmounted sonner too, and sonner's imperative DOM cleanup then threw
// "removeChild: the node to be removed is not a child of this node" — a second, misleading error
// that masked the real one in the crash screen.
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </QueryProvider>
  );
}
