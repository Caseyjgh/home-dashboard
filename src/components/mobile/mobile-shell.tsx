"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useFamily } from "../family-provider";

const links = [["/mobile", "Home"], ["/mobile/calendar", "Calendar"], ["/mobile/meals", "Dinner"], ["/mobile/todos", "To-Do"], ["/mobile/events", "Events"]];
export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status } = useFamily();
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  async function signIn() {
    setSigningIn(true); setError("");
    try {
      const { signIn } = await import("next-auth/react");
      await signIn("google", { redirectTo: pathname });
    } catch { setError("Sign-in could not start. Please try again."); }
    finally { setSigningIn(false); }
  }
  return <div className="mobile-app">
    <header className="mobile-header"><Link href="/mobile" prefetch={false}>Our home</Link><Link href="/" prefetch={false} className="mobile-pi-link">Pi dashboard</Link></header>
    <div className="mobile-content">
      {status === "signin" && <section className="mobile-card mobile-signin"><p>Sign in with the same Google account as your Pi to see and edit your household.</p><button className="primary" disabled={signingIn} onClick={signIn}>{signingIn ? "Opening Google…" : "Sign in with Google"}</button></section>}
      {error && <p role="alert">{error}</p>}
      {pathname !== "/mobile" && <Link className="mobile-back" href="/mobile" prefetch={false}>← Back to Home</Link>}
      {children}
    </div>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{links.map(([href, label]) => <Link key={href} href={href} prefetch={false} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav>
  </div>;
}
