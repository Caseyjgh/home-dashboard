import { CalendarPanel } from "@/components/calendar-panel";
import { HouseholdCards } from "@/components/household-cards";

export default function Home() {
  return <main className="home-grid" aria-label="Home dashboard"><h1 className="sr-only">Home dashboard</h1><CalendarPanel /><HouseholdCards /></main>;
}
