import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import "./globals.css";
import { ACCENT_BOOT_SCRIPT } from "@/features/settings/accent-script";
import { THEME_BOOT_SCRIPT } from "@/features/settings/theme-script";
import { NoZoom } from "@/components/no-zoom";
import { SampledAnalytics } from "@/components/sampled-analytics";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Only used by a few screens (profile, admin, settings, map): no need to preload it on every page.
  preload: false,
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BlocusApp",
  description: "BlocusApp",
  applicationName: "BlocusApp",
  // iOS: standalone mode when added to the home screen.
  appleWebApp: { capable: true, title: "BlocusApp", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  // Required for env(safe-area-inset-*) on iPhones with a notch.
  viewportFit: "cover",
  // The app is laid out as a native-style mobile app at 100 %: no pinch or double-tap zoom. Android honours
  // these; iOS ignores them, so `NoZoom` and `touch-action` in globals.css cover it (see docs/architecture.md).
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the saved theme and accent color before first paint (no flash of the defaults). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <NoZoom />
        <ServiceWorkerRegister />
        <SampledAnalytics />
      </body>
    </html>
  );
}
