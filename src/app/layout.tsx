import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/app-header";
import { FamilyProvider } from "@/components/family-provider";

export const metadata: Metadata = {
  title: "Home Command Center",
  description: "Calendar, dinner, and Lilly and Sawyer’s to-dos in one dashboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body><AppHeader /><FamilyProvider>{children}</FamilyProvider></body>
    </html>
  );
}
