"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui";

type Step = "pick" | "map" | "committing" | "done";

const REQUIRED_FIELDS = ["email"] as const;
const OPTIONAL_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "companyName",
  "source",
  "niche",
  "serviceInterest",
  "annualRevenueRange",
  "taxesPaidLastYearRange",
  "propertyCount",
  "urgency",
  "painPoint",
  "notes",
] as const;

type FieldName = (typeof REQUIRED_FIELDS)[number] | (typeof OPTIONAL_FIELDS)[number];
const ALL_FIELDS: FieldName[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

// Simple aliases: common CSV headers → canonical field names.
const ALIAS_TO_FIELD: Record<string, FieldName> = {
  email: "email",
  "email address": "email",
  "e-mail": "email",
  "first name": "firstName",
  first: "firstName",
  firstname: "firstName",
  "last name": "lastName",
  last: "lastName",
  lastname: "lastName",
  name: "firstName",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  company: "companyName",
  companyname: "companyName",
  business: "companyName",
  source: "source",
  lead_source: "source",
  niche: "niche",
  service: "serviceInterest",
  "service interest": "serviceInterest",
  revenue: "annualRevenueRange",
  "annual revenue": "annualRevenueRange",
  taxes: "taxesPaidLastYearRange",
  properties: "propertyCount",
  "property count": "propertyCount",
  urgency: "urgency",
  "pain point": "painPoint",
  painpoint: "painPoint",
  notes: "notes",
};

type Outcome =
  | { index: number; status: "created" | "merged"; leadId: string; score: number; grade: string }
  | { index: number; status: "error"; error: string };

export function CsvImporter() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, FieldName | "">>({});
  const [result, setResult] = useState<{
    summary: { total: number; created: number; merged: number; errors: number };
    outcomes: Outcome[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File) {
    setErr(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed || parsed.headers.length === 0) {
      setErr("Couldn't parse that file. Make sure it's a CSV with a header row.");
      return;
    }
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    // Pre-fill mapping from aliases
    const map: Record<string, FieldName | ""> = {};
    for (const h of parsed.headers) {
      map[h] = ALIAS_TO_FIELD[h.toLowerCase().trim()] ?? "";
    }
    setMapping(map);
    setStep("map");
  }

  const emailMapped = useMemo(
    () => Object.values(mapping).some((v) => v === "email"),
    [mapping]
  );

  async function commit() {
    setStep("committing");
    setErr(null);
    const mapped = rows.map((cells) => {
      const out: Record<string, string> = {};
      headers.forEach((h, i) => {
        const field = mapping[h];
        if (!field) return;
        const val = cells[i]?.trim();
        if (val) out[field] = val;
      });
      return out;
    });
    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: mapped }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Import failed");
        setStep("map");
        return;
      }
      setResult(data);
      setStep("done");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
      setStep("map");
    }
  }

  if (step === "pick") {
    return (
      <Card>
        <CardHeader title="Upload a CSV" />
        <CardBody>
          <p className="text-sm text-brand-muted">
            Drop a CSV with a header row. Required column: <code className="text-brand-blue">email</code>.
            Everything else is optional and can be mapped in the next step.
          </p>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-hairline bg-brand-blue-tint/40 px-6 py-10 text-center hover:border-brand-blue">
            <span className="text-sm font-medium text-brand-navy">Click to choose a file</span>
            <span className="mt-1 text-xs text-brand-muted">or drop one here</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
          {err ? <div className="mt-3 text-xs text-rose-700">{err}</div> : null}
        </CardBody>
      </Card>
    );
  }

  if (step === "map" || step === "committing") {
    return (
      <Card>
        <CardHeader
          title={`Map columns — ${fileName}`}
          action={
            <button
              onClick={() => {
                setStep("pick");
                setHeaders([]);
                setRows([]);
                setMapping({});
              }}
              className="text-xs text-brand-muted hover:text-brand-navy"
            >
              Start over
            </button>
          }
        />
        <CardBody>
          <p className="text-sm text-brand-muted">
            Point each column to a FABBI field. Anything left blank will be ignored.{" "}
            <span className="font-medium text-brand-navy">{rows.length}</span> rows ready.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {headers.map((h) => (
              <div key={h} className="flex items-center gap-3 rounded-md border border-brand-hairline bg-white px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-brand-navy">{h}</div>
                  <div className="truncate text-[11px] text-brand-muted">
                    sample: {rows[0]?.[headers.indexOf(h)] ?? "—"}
                  </div>
                </div>
                <select
                  value={mapping[h] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [h]: (e.target.value as FieldName) || "" }))
                  }
                  className="rounded-md border border-brand-hairline bg-white px-2 py-1 text-xs text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                >
                  <option value="">— ignore —</option>
                  {ALL_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div className="text-xs text-brand-muted">
              {emailMapped ? (
                <span className="text-emerald-700">✓ email column mapped</span>
              ) : (
                <span className="text-rose-700">Map a column to email to continue</span>
              )}
            </div>
            <button
              onClick={commit}
              disabled={!emailMapped || step === "committing"}
              className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {step === "committing" ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
          {err ? <div className="mt-3 text-xs text-rose-700">{err}</div> : null}
        </CardBody>
      </Card>
    );
  }

  // done
  return (
    <Card>
      <CardHeader title="Import complete" />
      <CardBody>
        {result ? (
          <>
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Total" value={result.summary.total} />
              <Stat label="Created" value={result.summary.created} tone="emerald" />
              <Stat label="Merged" value={result.summary.merged} tone="brand" />
              <Stat label="Errors" value={result.summary.errors} tone={result.summary.errors > 0 ? "rose" : "muted"} />
            </div>
            {result.summary.errors > 0 ? (
              <div className="mt-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
                  Errors (first 20)
                </div>
                <ul className="mt-2 space-y-1 text-xs">
                  {result.outcomes
                    .filter((o): o is Extract<Outcome, { status: "error" }> => o.status === "error")
                    .slice(0, 20)
                    .map((o) => (
                      <li key={o.index} className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-800">
                        <span className="font-mono">row {o.index + 1}</span>: {o.error}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => {
                  setStep("pick");
                  setResult(null);
                }}
                className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
              >
                Import another
              </button>
              <a
                href="/contacts"
                className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-blue-dark"
              >
                View contacts
              </a>
            </div>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "emerald" | "brand" | "rose";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "brand"
        ? "text-brand-blue"
        : tone === "rose"
          ? "text-rose-700"
          : "text-brand-navy";
  return (
    <div className="rounded-md border border-brand-hairline bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

// Lightweight CSV parser that handles quoted fields, commas and escaped quotes.
function parseCsv(text: string): { headers: string[]; rows: string[][] } | null {
  const cleaned = text.replace(/^\ufeff/, "").replace(/\r\n/g, "\n");
  if (!cleaned.trim()) return null;

  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < cleaned.length) {
    const c = cleaned[i];
    if (inQuotes) {
      if (c === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      cur.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n") {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  if (rows.length === 0) return null;
  const headers = (rows[0] ?? []).map((h) => h.trim());
  return { headers, rows: rows.slice(1).filter((r) => r.some((c) => c.trim().length > 0)) };
}
