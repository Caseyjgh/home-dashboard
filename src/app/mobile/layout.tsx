import type { Metadata, Viewport } from "next";
import { MobileShell } from "@/components/mobile/mobile-shell";
import "./mobile.css";

export const metadata: Metadata = {
  title: "Our Home",
  applicationName: "Our Home",
  description: "Your household dashboard and pocket control panel.",
  manifest: "/mobile.webmanifest",
  appleWebApp: { capable: true, title: "Our Home", statusBarStyle: "default" },
  icons: { icon: "/mobile-icon.svg", apple: "/mobile-apple-icon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#10233e" };
export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <MobileShell>{children}</MobileShell>;
}
