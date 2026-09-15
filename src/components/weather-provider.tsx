"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Forecast } from "@/lib/weather";
const Context = createContext<{ forecast: Forecast | null; unavailable: boolean }>({ forecast: null, unavailable: false });
export function WeatherProvider({ children }: { children: ReactNode }) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let stopped = false;
    let lastAttempt = 0;
    async function refresh() {
      clearTimeout(timer);
      if (stopped || document.hidden || !navigator.onLine) return;
      controller?.abort(); controller = new AbortController();
      const active = controller;
      lastAttempt = Date.now();
      const deadline = setTimeout(() => active.abort(), 20000);
      try {
        const response = await fetch("/api/weather", { signal: active.signal });
        const result = await response.json();
        if (!response.ok || !result.forecast?.current || !Array.isArray(result.forecast?.days) || result.forecast.days.length < 6) throw new Error("Unavailable");
        if (!stopped) { setForecast(result.forecast); setUnavailable(false); }
      } catch { if (!stopped) setUnavailable(true); }
      finally { clearTimeout(deadline); if (!stopped && !document.hidden) { clearTimeout(timer); timer = setTimeout(refresh, 15 * 60000); } }
    }
    function resume() {
      if (document.hidden) { clearTimeout(timer); return; }
      const remaining = Math.max(0, 15 * 60000 - (Date.now() - lastAttempt));
      clearTimeout(timer); timer = setTimeout(refresh, remaining);
    }
    timer = setTimeout(refresh, 0);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume); };
  }, []);
  return <Context.Provider value={{ forecast, unavailable }}>{children}</Context.Provider>;
}
export function useWeather() { return useContext(Context); }
