"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useFamily } from "./family-provider";
import { DASHBOARD_RELOAD_INTERVAL, startDashboardReload } from "@/lib/dashboard-reload";

export function DashboardReload() {
  const pathname = usePathname();
  const { saving } = useFamily();
  const deadline = useRef<number | null>(null);
  useEffect(() => {
    deadline.current ??= Date.now() + DASHBOARD_RELOAD_INTERVAL;
    return startDashboardReload(
      () => (pathname === "/" || pathname === "/mobile") && !saving && !document.querySelector(".calendar-settings"),
      () => window.location.reload(),
      deadline.current,
    );
  }, [pathname, saving]);
  return null;
}
