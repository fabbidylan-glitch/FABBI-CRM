import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { NewDealForm } from "@/components/str/new-deal-form";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { config } from "@/lib/config";
import { getSTRAccess } from "@/lib/features/str/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewSTRDealPage() {
  if (!config.dbEnabled || !config.authEnabled) {
    redirect("/str-deals");
  }
  const actor = await getSTRAccess();
  if (!actor) redirect("/str-deals");

  return (
    <Shell title="New STR deal">
      <div className="mb-4 flex items-center gap-2 text-xs text-brand-muted">
        <Link
          href="/str-deals"
          className="inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 transition hover:border-brand-hairline hover:bg-white hover:text-brand-navy"
        >
          <span aria-hidden>←</span> All STR deals
        </Link>
      </div>
      <Card className="mx-auto max-w-2xl">
        <CardHeader title="Create a deal" />
        <CardBody>
          <p className="mb-5 text-sm text-brand-muted">
            Capture the basics — you can fill in financing, revenue, and
            expense assumptions on the deal page.
          </p>
          <NewDealForm />
        </CardBody>
      </Card>
    </Shell>
  );
}
