import type { Metadata } from "next";
import { scheduledThemeScript } from "@/lib/scheduled-theme";
import "./globals.css";
import { WeatherProvider } from "@/components/weather-provider";
import { AppHeader } from "@/components/app-header";
import { FamilyProvider } from "@/components/family-provider";

export const metadata: Metadata = {
  title: "Home Command Center",
  description: "Calendar, dinner, and Lilly and Sawyer’s to-dos in one dashboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head><script id="scheduled-theme" dangerouslySetInnerHTML={{ __html: scheduledThemeScript }} /></head>
      <body><WeatherProvider><AppHeader /><FamilyProvider>{children}</FamilyProvider></WeatherProvider></body>
    </html>
  );
}
