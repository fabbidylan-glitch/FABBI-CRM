import { CsvImporter } from "@/components/csv-importer";
import { Shell } from "@/components/shell";
import Link from "next/link";

export const metadata = { title: "Import contacts — FABBI CRM" };

export default function ContactsImportPage() {
  return (
    <Shell title="Import contacts">
      <div className="mb-4 flex items-center gap-3 text-sm text-brand-muted">
        <Link href="/contacts" className="hover:text-brand-navy">← All contacts</Link>
      </div>
      <div className="max-w-3xl">
        <CsvImporter />
      </div>
    </Shell>
  );
}
