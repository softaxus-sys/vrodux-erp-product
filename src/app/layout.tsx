import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
};

/**
 * The real <html> tag is emitted by the [locale] layout, which is where lang and dir
 * are known. This root exists only because Next requires one.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
