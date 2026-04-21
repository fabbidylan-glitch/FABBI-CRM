import { SignUp } from "@clerk/nextjs";
import { config } from "@/lib/config";

export const metadata = { title: "Sign up — FABBI CRM" };

export default function SignUpPage() {
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
          <SignUp />
        ) : (
          <div className="rounded-xl border border-brand-hairline bg-white p-6 text-sm shadow-card">
            <h2 className="font-semibold text-brand-navy">Auth is not configured yet</h2>
            <p className="mt-2 text-brand-muted">
              Add your Clerk keys to <code>.env</code> and restart the dev server.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
