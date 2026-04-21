import { SignIn } from "@clerk/nextjs";
import { config } from "@/lib/config";

export const metadata = { title: "Sign in — FABBI CRM" };

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-blue-tint px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-blue">
            Internal CRM
          </div>
          <div className="mt-1 text-2xl font-semibold text-brand-navy">FABBI</div>
        </div>
        {config.authEnabled ? (
          <SignIn />
        ) : (
          <div className="rounded-xl border border-brand-hairline bg-white p-6 text-sm shadow-card">
            <h2 className="font-semibold text-brand-navy">Auth is not configured yet</h2>
            <p className="mt-2 text-brand-muted">
              Set{" "}
              <code className="rounded bg-brand-blue-tint px-1 py-0.5 text-brand-blue">CLERK_SECRET_KEY</code>{" "}
              and{" "}
              <code className="rounded bg-brand-blue-tint px-1 py-0.5 text-brand-blue">
                NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
              </code>{" "}
              in <code>.env</code> to enable sign-in.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
