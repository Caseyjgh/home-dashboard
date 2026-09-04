import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Home — Personal Dashboard",
  description: "A calm, focused place to begin the day.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
