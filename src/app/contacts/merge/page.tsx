import { ContactsMerge } from "@/components/contacts-merge";
import { Shell } from "@/components/shell";
import { listContacts } from "@/lib/features/contacts/queries";
import Link from "next/link";

export const metadata = { title: "Merge contacts — FABBI CRM" };

export default async function ContactsMergePage() {
  const contacts = await listContacts();
  return (
    <Shell title="Merge contacts">
      <div className="mb-4 flex items-center gap-3 text-sm text-brand-muted">
        <Link href="/contacts" className="hover:text-brand-navy">← All contacts</Link>
      </div>
      <div className="max-w-3xl">
        <ContactsMerge contacts={contacts} />
      </div>
    </Shell>
  );
}
