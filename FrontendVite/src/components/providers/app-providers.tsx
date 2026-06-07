import * as React from "react";
import { Toaster } from "sonner";
import { QueryProvider }  from "./query-provider";
import { ThemeProvider }  from "./theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        {children}
        <Toaster
          richColors
          position="top-right"
          toastOptions={{ duration: 4000 }}
        />
      </ThemeProvider>
    </QueryProvider>
  );
}
