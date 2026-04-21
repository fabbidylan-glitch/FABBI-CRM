import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

// Routes that must stay publicly accessible even when auth is on:
// the public intake form, its API, and the Clerk sign-in/sign-up flows.
const isPublicRoute = createRouteMatcher([
  "/intake",
  "/api/public/:path*",
  "/api/cron/:path*",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const authEnabled = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

const handler = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  const { userId, redirectToSignIn } = await auth();
  if (!userId) {
    // API callers can't handle a 307 to an HTML sign-in page — the browser
    // fetch() would silently follow it and then JSON.parse would blow up on
    // the returned HTML. Return plain 401 JSON for anything under /api/.
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return redirectToSignIn();
  }
});

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (!authEnabled) return NextResponse.next();
  return handler(req, ev);
}

export const config = {
  // Match everything except Next.js internals and static files.
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
