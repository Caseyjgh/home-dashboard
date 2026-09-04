import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { CalendarCache, CalendarChoice } from "./calendar-types";

const PREFIX = "home-dashboard:calendar";
const COOLDOWN_SECONDS = 5 * 60;

export function calendarCacheConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function redis() {
  if (!calendarCacheConfigured()) throw new Error("Calendar cache is not configured");
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

function userKey(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function key(email: string, suffix: string) {
  return `${PREFIX}:${userKey(email)}:${suffix}`;
}

export async function getCalendarCache(email: string) {
  return redis().get<CalendarCache>(key(email, "events"));
}

export async function saveCalendarCache(email: string, data: CalendarCache) {
  await redis().set(key(email, "events"), data);
}

export async function getCalendarChoices(email: string) {
  return redis().get<CalendarChoice[]>(key(email, "calendars"));
}

export async function saveCalendarChoices(email: string, calendars: CalendarChoice[]) {
  await redis().set(key(email, "calendars"), calendars);
}

export async function getSelectedCalendarIds(email: string) {
  return (await redis().get<string[]>(key(email, "selected"))) ?? [];
}

export async function saveSelectedCalendarIds(email: string, ids: string[]) {
  await redis().set(key(email, "selected"), ids);
}

export async function getCalendarTimeZone(email: string) {
  return (await redis().get<string>(key(email, "timezone"))) ?? process.env.GOOGLE_CALENDAR_TIME_ZONE ?? "America/Denver";
}

export async function saveCalendarTimeZone(email: string, timeZone: string) {
  await redis().set(key(email, "timezone"), timeZone);
}

export async function beginRefresh(email: string) {
  const cooldownKey = key(email, "refresh-cooldown");
  const result = await redis().set(cooldownKey, new Date().toISOString(), {
    nx: true,
    ex: COOLDOWN_SECONDS,
  });
  if (result === "OK") return { allowed: true as const, retryAfter: 0 };
  const ttl = await redis().ttl(cooldownKey);
  return { allowed: false as const, retryAfter: Math.max(ttl, 1) };
}
