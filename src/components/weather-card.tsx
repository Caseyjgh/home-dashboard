"use client";
import { degrees, weatherDescription, weatherIcon } from "@/lib/weather";
import { useWeather } from "./weather-provider";
export function WeatherCard() {
  const { forecast, unavailable } = useWeather();
  const today = forecast?.days[0];
  return <section className="weather-card" aria-labelledby="weather-heading"><div className="weather-card-heading"><h2 id="weather-heading">Windsor weather</h2><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a></div>
    {forecast && today ? <>
      <div className="weather-current"><strong className="weather-temperature">{degrees(forecast.current.temperature)}<span>F</span></strong><div><p>{weatherDescription(forecast.current.code)}</p><p className="weather-details">High {degrees(today.high)} · Low {degrees(today.low)} · Precip {today.precipitation === null ? "—" : `${Math.round(today.precipitation)}%`}</p></div></div>
      <p className="weather-extras">Feels like {degrees(forecast.current.feelsLike)} · Wind {forecast.current.wind === null ? "—" : `${Math.round(forecast.current.wind)} mph`}{unavailable ? " · Saved forecast" : ""}</p>
      <ol className="weather-days" aria-label="Next five days">{forecast.days.slice(1, 6).map(day => <li key={day.date}>
        <time dateTime={day.date}>{new Date(`${day.date}T12:00:00-06:00`).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Denver" })}</time>
        <span className="weather-symbol" role="img" aria-label={weatherDescription(day.code)} title={weatherDescription(day.code)}>{weatherIcon(day.code)}</span>
        <span>{degrees(day.high)} / {degrees(day.low)}</span>
      </li>)}</ol>
    </> : <p role="status" className="weather-unavailable">{unavailable ? "Weather is temporarily unavailable. It will retry automatically." : "Loading Windsor forecast…"}</p>}
  </section>;
}
