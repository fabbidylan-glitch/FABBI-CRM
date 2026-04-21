import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// Sentry is a no-op at build + runtime unless SENTRY_DSN env is set, so it's
// safe to keep this wrapper on even before you sign up.
export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  // Org + project slugs are optional; source maps work without them, though
  // you get slightly less context on the error. Fill in once the Sentry
  // project exists.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
