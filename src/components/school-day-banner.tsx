"use client";

import { useEffect, useState } from "react";
import { getDenverDateKey, getSchoolDayStatuses } from "../../lib/schoolCalendars";

const labels = {
  blue: "BLUE DAY",
  green: "GREEN DAY",
  "no-school": "NO SCHOOL",
  maroon: "MAROON DAY",
  gold: "GOLD DAY",
};

export function SchoolDayBanner() {
  // Start neutral so server and browser render the same markup across midnight.
  const [dateKey, setDateKey] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const checkDate = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      const nextDateKey = getDenverDateKey();
      setDateKey((previous) => previous === nextDateKey ? previous : nextDateKey);
      timer = setTimeout(checkDate, 120_000);
    };
    timer = setTimeout(checkDate, 0);
    document.addEventListener("visibilitychange", checkDate);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkDate);
    };
  }, []);

  const statuses = dateKey ? getSchoolDayStatuses(dateKey) : null;
  return <section className="school-day-banner" aria-label="School-day rotations">
    {[statuses?.wca, statuses?.whs].map((status, index) =>
      <div key={index} className={`school-day-half school-day-${status ?? "unknown"}`}>
        {status ? labels[status] : "—"}
      </div>
    )}
  </section>;
}
