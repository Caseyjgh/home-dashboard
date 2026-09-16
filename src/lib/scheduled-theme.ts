// Runs once in the document head before hydration. No network or React state is
// needed to change the palette, and navigating between routes keeps one timer.
export const scheduledThemeScript = String.raw`(() => {
  const hours = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver', hour: 'numeric', hourCycle: 'h23'
  });
  let timer;
  function update() {
    clearTimeout(timer);
    const hour = Number(hours.format(new Date()));
    const theme = hour >= 21 || hour < 5 ? 'dark' : 'light';
    if (document.documentElement.dataset.theme !== theme) {
      document.documentElement.dataset.theme = theme;
    }
    // Minute boundaries include 21:00 and 05:00 in both MST and MDT. Rechecking
    // also handles daylight saving time, clock adjustments and suspended tabs.
    if (!document.hidden) timer = setTimeout(update, 60000 - Date.now() % 60000);
  }
  document.addEventListener('visibilitychange', update);
  window.addEventListener('focus', update);
  window.addEventListener('pageshow', update);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  update();
})();`;
