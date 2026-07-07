// Home = the Arcade (owner decision 2026-07-07): the old landing page read as a
// worse copy of /arcade, so the root simply redirects there. If a traditional
// marketing home page ever returns, it replaces this redirect.

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/arcade");
}
