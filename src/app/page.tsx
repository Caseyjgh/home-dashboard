import { ImportantEvents } from "@/components/important-events";
import { CalendarPanel } from "@/components/calendar-panel";
import { HouseholdCards } from "@/components/household-cards";
import { SchoolDayBanner } from "@/components/school-day-banner";

export default function Home() {
  return <main className="home-grid" aria-label="Home dashboard"><h1 className="sr-only">Home dashboard</h1><div className="calendar-column"><SchoolDayBanner /><ImportantEvents /><CalendarPanel /></div><HouseholdCards /></main>;
}
