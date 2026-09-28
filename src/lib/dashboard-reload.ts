export const DASHBOARD_RELOAD_INTERVAL = 2 * 60 * 60 * 1000;

// One deadline per document, including time spent on another route or asleep.
export function startDashboardReload(canReload: () => boolean, reload: () => void, deadline: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const pause = () => clearTimeout(timer);
  function check() {
    pause();
    if (stopped || document.hidden || !navigator.onLine) return;
    const remaining = deadline - Date.now();
    if (remaining <= 0 && canReload()) {
      stop();
      reload();
      return;
    }
    timer = setTimeout(check, remaining > 0 ? remaining : 30_000);
  }
  function stop() {
    stopped = true;
    pause();
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("online", check);
    window.removeEventListener("offline", pause);
    window.removeEventListener("focus", check);
    window.removeEventListener("pageshow", check);
    window.removeEventListener("pagehide", pause);
  }
  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
  window.addEventListener("offline", pause);
  window.addEventListener("focus", check);
  window.addEventListener("pageshow", check);
  window.addEventListener("pagehide", pause);
  // Let React finish mounting before a possibly overdue reload.
  timer = setTimeout(check, Math.max(0, deadline - Date.now()));
  return stop;
}
