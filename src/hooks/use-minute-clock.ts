"use client";

import { useEffect, useState } from "react";

// The UI displays minutes, so do no work between minute boundaries or hidden.
export function useMinuteClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      clearTimeout(timer);
      if (document.hidden) return;
      setNow(new Date());
      timer = setTimeout(update, 60_000 - Date.now() % 60_000);
    }
    timer = setTimeout(update, 0);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}
