"use client";
import { useEffect, useState } from "react";
import { weatherDescription, type Forecast } from "@/lib/weather";
export function HeaderWeather() {
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
        if (!response.ok || !result.forecast) throw new Error("Unavailable");
        if (!stopped) { setForecast(result.forecast); setUnavailable(false); }
      } catch { if (!stopped) setUnavailable(true); }
      finally { clearTimeout(deadline); if (!stopped && !document.hidden) { clearTimeout(timer); timer = setTimeout(refresh, 30 * 60000); } }
    }
    function resume() {
      if (document.hidden) { clearTimeout(timer); return; }
      const remaining = Math.max(0, 30 * 60000 - (Date.now() - lastAttempt));
      clearTimeout(timer); timer = setTimeout(refresh, remaining);
    }
    timer = setTimeout(refresh, 0);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume); };
  }, []);
  return <a className="header-weather" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" aria-label={forecast ? `${forecast.location} forecast from Open-Meteo: ${weatherDescription(forecast.code)}, high ${Math.round(forecast.high)}, low ${Math.round(forecast.low)} Fahrenheit${unavailable ? ", last saved forecast" : ""}` : "Weather forecast from Open-Meteo"}>
    {forecast ? <><span className="weather-location">{forecast.location} · </span>{weatherDescription(forecast.code)} <strong>↑{Math.round(forecast.high)}° ↓{Math.round(forecast.low)}°F</strong>{unavailable && <span> · saved</span>}</> : unavailable ? "Weather unavailable" : "Loading weather…"}
  </a>;
}
