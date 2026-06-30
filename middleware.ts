import { clerkMiddleware } from "@clerk/nextjs/server";

// Public arena: every page (home, leaderboard, matchups, the sandboxed player) is
// browsable and playable without an account. clerkMiddleware runs only to attach the
// Clerk auth context to requests — it does NOT gate routes here.
//
// Auth is enforced where it actually matters: casting a vote. That check lives in the
// route handler (app/api/vote/route.ts -> requireGrader() in lib/auth.ts), so anonymous
// visitors can do everything except vote. If more grader-only surfaces appear later,
// protect them there or switch to auth.protect() on a createRouteMatcher() of those paths.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
