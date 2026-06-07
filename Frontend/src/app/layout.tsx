import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Softaxis ERP",
    template: "%s | Softaxis ERP",
  },
  description:
    "Enterprise Resource Planning platform for modern businesses in the UAE and beyond.",
  keywords: ["ERP", "enterprise", "SaaS", "UAE", "business management"],
  authors: [{ name: "Softaxis" }],
  creator: "Softaxis",
  metadataBase: new URL("https://erp.softaxis.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://erp.softaxis.com",
    title: "Softaxis ERP",
    description: "World-class enterprise ERP for modern businesses",
    siteName: "Softaxis ERP",
  },
  robots: {
    index: false, // Private SaaS — don't index
    follow: false,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-background`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange={false}
        >
          <QueryProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                classNames: {
                  toast: "bg-card border border-border shadow-enterprise-md",
                  title: "text-card-foreground font-medium",
                  description: "text-muted-foreground",
                },
              }}
            />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
