"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import type { CalendarCache } from "@/lib/calendar-types";

export type CalendarState = {
  loading: boolean;
  configured: boolean;
  authenticated: boolean;
  cache: CalendarCache | null;
  selectedIds: string[];
  missingVariables: string[];
  timeZone?: string;
  account?: { name: string | null; email: string } | null;
  calendarAccess?: boolean | null;
};

export function useCachedCalendar() {
  const [calendar, setCalendar] = useState<CalendarState>({
    loading: true, configured: false, authenticated: false, cache: null,
    selectedIds: [], missingVariables: [],
  });
  const [connection, setConnection] = useState<"loading" | "ready" | "offline" | "error">("loading");
  const loadRef = useRef<() => void>(() => {});
  const reloadCache = useCallback(() => loadRef.current(), []);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    let lastSuccess = 0;

    async function load() {
      clearTimeout(timer);
      if (disposed || controller || document.hidden) return;
      if (!navigator.onLine) {
        setConnection("offline");
        setCalendar((current) => ({ ...current, loading: false }));
        return;
      }
      controller = new AbortController();
      try {
        // This route reads Redis only. Never retry a Google refresh/mutation.
        const { response, data } = await requestJson<Omit<CalendarState, "loading">>(
          "/api/calendar", { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok || typeof data.configured !== "boolean" ||
          typeof data.authenticated !== "boolean" || !Array.isArray(data.selectedIds) ||
          !Array.isArray(data.missingVariables)) throw new Error("Calendar unavailable");
        if (disposed) return;
        setCalendar((current) => ({
          ...data, loading: false,
          // A manual refresh may have completed while this read was in flight.
          cache: data.authenticated && current.account?.email === data.account?.email &&
            current.cache && data.cache && current.cache.refreshedAt > data.cache.refreshedAt
            ? current.cache : data.cache,
        }));
        setConnection("ready");
        failures = 0;
        lastSuccess = Date.now();
      } catch {
        if (disposed) return;
        setConnection(navigator.onLine ? "error" : "offline");
        // Keep the last successful data on screen, including account state.
        setCalendar((current) => ({ ...current, loading: false }));
        const delay = [15_000, 60_000, 300_000][Math.min(failures++, 2)];
        timer = setTimeout(load, delay);
      } finally {
        controller = null;
      }
    }

    function offline() { setConnection("offline"); }
    function visible() {
      if (document.hidden) clearTimeout(timer);
      else if (failures > 0 || Date.now() - lastSuccess >= 300_000) void load();
    }
    loadRef.current = () => { void load(); };
    timer = setTimeout(load, 0);
    window.addEventListener("online", reloadCache);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      loadRef.current = () => {};
      window.removeEventListener("online", reloadCache);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [reloadCache]);

  return { calendar, setCalendar, connection, reloadCache };
}
