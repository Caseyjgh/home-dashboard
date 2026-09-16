"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { requestJson } from "@/lib/client-request";
import type { FamilyCommand, FamilyData } from "@/lib/family-model";

const REFRESH_INTERVAL = 30_000;

type Status = "loading" | "ready" | "signin" | "offline" | "error";
type FamilyContext = { data: FamilyData | null; status: Status; error: string | null; saving: boolean; refresh: () => void; save: (command: FamilyCommand, revision?: number) => Promise<boolean> };
const Context = createContext<FamilyContext | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FamilyData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const latest = useRef<FamilyData | null>(null);
  const etag = useRef("");
  const reading = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const disposed = useRef(false);
  const failures = useRef(0);
  const lastRead = useRef(0);

  const accept = useCallback((next: FamilyData) => {
    if (latest.current?.revision === next.revision) return;
    latest.current = next;
    setData(next);
  }, []);

  const refresh = useCallback(async function load() {
    if (disposed.current || reading.current || writing.current || document.hidden) return;
    clearTimeout(timer.current);
    if (!navigator.onLine) { setStatus("offline"); return; }
    const controller = new AbortController();
    reading.current = controller;
    const deadline = setTimeout(() => controller.abort(), 30_000);
    let delay: number | undefined;
    try {
      const response = await fetch("/api/family", { cache: "no-store", signal: controller.signal, headers: etag.current ? { "If-None-Match": etag.current } : {} });
      if (response.status === 401) {
        latest.current = null; etag.current = ""; setData(null); setStatus("signin"); setError(null);
        return;
      }
      if (response.status !== 304) {
        const result = await response.json() as { data?: FamilyData; error?: string };
        if (!response.ok || !result.data) throw new Error(result.error || "Shared data could not be loaded.");
        if (controller.signal.aborted || disposed.current) return;
        accept(result.data);
        etag.current = response.headers.get("etag") || "";
      }
      setStatus("ready"); setError(null); failures.current = 0; lastRead.current = Date.now();
      delay = REFRESH_INTERVAL;
    } catch (failure) {
      if (disposed.current || writing.current) return;
      setStatus(navigator.onLine ? "error" : "offline");
      setError("Shared data could not be refreshed. Showing the last saved entries where available.");
      delay = [15_000, 60_000, 300_000][Math.min(failures.current++, 2)];
      void failure;
    } finally {
      clearTimeout(deadline);
      if (reading.current === controller) reading.current = null;
      if (delay && !disposed.current && !writing.current && !document.hidden && navigator.onLine) timer.current = setTimeout(load, delay);
    }
  }, [accept]);

  const save = useCallback(async (command: FamilyCommand, revision?: number) => {
    if (writing.current || !latest.current || disposed.current) return false;
    writing.current = true;
    reading.current?.abort();
    clearTimeout(timer.current);
    setSaving(true); setError(null);
    let success = false;
    try {
      const { response, data: result } = await requestJson<{ data?: FamilyData; error?: string }>("/api/family", {
        method: "POST", signal: lifetime.current?.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: revision ?? latest.current.revision, command }),
      });
      if (disposed.current) return false;
      if (result.data) { accept(result.data); etag.current = ""; }
      if (response.status === 401) {
        latest.current = null; etag.current = ""; setData(null); setStatus("signin");
      }
      if (!response.ok) throw new Error(result.error || "Changes could not be saved.");
      setStatus("ready"); success = true;
      return true;
    } catch (failure) {
      if (!disposed.current) setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "Save could not be confirmed. Refresh shared data before trying again.");
      return false;
    } finally {
      writing.current = false;
      if (!disposed.current) {
        setSaving(false);
        timer.current = setTimeout(refresh, success ? REFRESH_INTERVAL : 15_000);
      }
    }
  }, [accept, refresh]);

  useEffect(() => {
    disposed.current = false;
    const controller = new AbortController();
    lifetime.current = controller;
    const online = () => { void refresh(); };
    const offline = () => { clearTimeout(timer.current); setStatus("offline"); };
    const visible = () => {
      if (document.hidden) clearTimeout(timer.current);
      else if (Date.now() - lastRead.current >= 10_000) void refresh();
      else { clearTimeout(timer.current); timer.current = setTimeout(refresh, REFRESH_INTERVAL); }
    };
    timer.current = setTimeout(refresh, 0);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed.current = true;
      clearTimeout(timer.current);
      reading.current?.abort(); controller.abort();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);

  return <Context.Provider value={{ data, status, error, saving, refresh, save }}>{children}</Context.Provider>;
}
export function useFamily() {
  const value = useContext(Context);
  if (!value) throw new Error("FamilyProvider is required");
  return value;
}
export function FamilyStatus() {
  const { status, error, refresh } = useFamily();
  if (status === "ready" && !error) return null;
  const message = status === "signin" ? "Sign in with Google in Settings to share dinner and to-dos across your devices." : status === "loading" ? "Loading shared entries…" : status === "offline" ? "Offline. Showing the last saved entries; changes need a connection." : error;
  return <div className="data-notice" role="status"><span>{message}</span>{status !== "loading" && status !== "signin" && <button type="button" onClick={refresh}>Refresh shared data</button>}</div>;
}
