"use client";
import { degrees, weatherDescription } from "@/lib/weather";
import { useWeather } from "./weather-provider";
export function HeaderWeather() {
  const { forecast, unavailable } = useWeather();
  return <a className="header-weather" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" aria-label="Windsor weather from Open-Meteo">
    {forecast ? <><span className="weather-location">Windsor · </span>{weatherDescription(forecast.current.code)} <strong>{degrees(forecast.current.temperature)}F</strong>{unavailable && <span> · saved</span>}</> : unavailable ? "Weather unavailable" : "Loading weather…"}
  </a>;
}
