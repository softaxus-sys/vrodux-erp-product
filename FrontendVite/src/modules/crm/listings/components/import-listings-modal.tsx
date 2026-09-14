import * as React from "react";
import { motion } from "framer-motion";
import { X, UploadCloud, Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/csv";
import { useImportPortalListings } from "@/hooks/crm/use-portal-listings";
import { LISTING_PORTALS } from "@/lib/crm/portal-listings.api";
import type { ImportListingRow, ImportListingsResult, ListingPortal } from "@/lib/crm/portal-listings.api";

/** Server caps a request; larger files are sent in chunks and the tallies summed. */
const CHUNK = 1000;

export const SAMPLE_LISTINGS_CSV = [
  "Reference,Listing URL,Title,Agent,Portal",
  "100104-SI9UFU,https://www.bayut.com/pm/15476575/f04557db-892e-4303-b329-2bdb4c3a1d3b,2BR Apartment in Dubai Marina,,Bayut",
  "100104-y1OGck,https://www.bayut.com/property/details-16224883.html,Villa in Arabian Ranches,ahmed@agency.ae,Bayut",
  "100104-uDkDxP,,Studio in JVC,Lorena Ortega,Bayut",
  ",https://www.bayut.com/pm/15943235/3f1c2a9e-1111-4c2b-9d8e-000000000000,Office in Business Bay,,Bayut",
].join("\r\n");

const HEADERS: Record<keyof ImportListingRow, string[]> = {
  reference: ["reference", "listing reference", "listing reference number", "ref", "reference number", "ref no", "refno"],
  url:       ["listing url", "url", "link", "listing link", "property url"],
  title:     ["title", "listing title", "property", "property title", "name"],
  agent:     ["agent", "agent email", "agent name", "email", "owner", "published by", "listing agent"],
  portal:    ["portal", "source", "platform", "website"],
};

/** Splits a delimited line, honouring quoted fields (a title can contain a comma). */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map(v => v.trim());
}

function parse(text: string): { rows: ImportListingRow[]; headerFound: boolean } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { rows: [], headerFound: false };

  // Tab first: a spreadsheet paste is tab-separated.
  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const head = splitLine(lines[0], delimiter).map(h => h.toLowerCase());
  const col = (k: keyof ImportListingRow) => head.findIndex(h => HEADERS[k].includes(h));

  const idx = { reference: col("reference"), url: col("url"), title: col("title"), agent: col("agent"), portal: col("portal") };
  const headerFound = idx.reference >= 0 || idx.url >= 0;
  // No recognised header: assume the sample's column order, and treat line 1 as data.
  const map = headerFound ? idx : { reference: 0, url: 1, title: 2, agent: 3, portal: 4 };

  const rows = lines.slice(headerFound ? 1 : 0).map(line => {
    const cells = splitLine(line, delimiter);
    const get = (i: number) => (i >= 0 ? cells[i]?.trim() || undefined : undefined);
    return { reference: get(map.reference), url: get(map.url), title: get(map.title), agent: get(map.agent), portal: get(map.portal) };
  }).filter(r => r.reference || r.url);

  return { rows, headerFound };
}

export function ImportListingsModal({ onClose, canAssignOthers }: { onClose: () => void; canAssignOthers: boolean }) {
  const importRows = useImportPortalListings();
  const [portal, setPortal] = React.useState<ListingPortal>("bayut");
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<ImportListingsResult | null>(null);
  const [progress, setProgress] = React.useState<string | null>(null);

  const { rows, headerFound } = React.useMemo(() => parse(text), [text]);

  const readFile = async (file: File) => { setResult(null); setText(await file.text()); };

  const run = async () => {
    const total: ImportListingsResult = { created: 0, skipped: 0, errors: [] };
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        setProgress(`Importing ${Math.min(i + CHUNK, rows.length)} of ${rows.length}…`);
        const r = await importRows.mutateAsync({ portal, rows: rows.slice(i, i + CHUNK) });
        total.created += r.created;
        total.skipped += r.skipped;
        // Row numbers are per chunk on the server; shift them back to file rows (+1 for the header).
        total.errors.push(...r.errors.map(e => ({ ...e, row: e.row + i + (headerFound ? 1 : 0) })));
      }
      setResult(total);
    } catch { /* hook toasts */ } finally { setProgress(null); }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col pointer-events-auto shadow-xl">
          <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
            <div>
              <h3 className="text-base font-bold text-foreground">Import existing listings</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Upload the listings you published before, so enquiries on them reach the right agent.
                Each row needs a reference or a listing URL.{" "}
                {canAssignOthers
                  ? "Put the agent's email (or exact full name) in the Agent column; leave it blank for yourself."
                  : "All rows are registered to you."}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {result ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-success/10 py-3">
                    <p className="text-xl font-bold text-success leading-none">{result.created}</p>
                    <p className="text-xs text-muted-foreground mt-1">Listings registered</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 py-3">
                    <p className="text-xl font-bold text-muted-foreground leading-none">{result.skipped}</p>
                    <p className="text-xs text-muted-foreground mt-1">Rows skipped</p>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-3 p-2.5 text-sm">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs"><span className="text-muted-foreground">Row {e.row}</span>
                            {e.listing && <span className="font-mono ms-2">{e.listing}</span>}</p>
                          <p className="text-[11px] text-muted-foreground">{e.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground">Portal (when the file has no Portal column)</label>
                    <select value={portal} onChange={e => setPortal(e.target.value as ListingPortal)}
                      className="mt-1 block h-9 text-sm rounded-md border border-border bg-card px-2">
                      {LISTING_PORTALS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5"
                    onClick={() => downloadFile("vrodux-listings-sample.csv", SAMPLE_LISTINGS_CSV)}>
                    <Download className="h-3.5 w-3.5" /> Download sample file
                  </Button>
                  <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-sm cursor-pointer hover:bg-muted/40">
                    <UploadCloud className="h-3.5 w-3.5" /> Choose CSV file
                    <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
                  </label>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground">Or paste rows (from Excel or Google Sheets, with the header row)</label>
                  <textarea value={text} onChange={e => { setResult(null); setText(e.target.value); }} rows={7} spellCheck={false}
                    placeholder={"Reference,Listing URL,Title,Agent,Portal\n100104-SI9UFU,https://www.bayut.com/pm/15476575/…,2BR Dubai Marina,,Bayut"}
                    className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Saving from Excel? Use <b>File → Save As → CSV (Comma delimited)</b>.
                  </p>
                </div>

                {rows.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      {rows.length} listing{rows.length === 1 ? "" : "s"} found
                      {!headerFound && " — no header row recognised, so columns are read in the sample's order"}
                    </p>
                    <div className="max-h-56 overflow-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/30 text-muted-foreground">
                          <tr>{["Reference", "URL", "Title", "Agent", "Portal"].map(h =>
                            <th key={h} className="px-2 py-1.5 text-start font-semibold">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 50).map((r, i) => (
                            <tr key={i} className="border-t border-border/60">
                              <td className="px-2 py-1.5 font-mono">{r.reference ?? "—"}</td>
                              <td className="px-2 py-1.5 truncate max-w-[220px]">{r.url ?? "—"}</td>
                              <td className="px-2 py-1.5 truncate max-w-[160px]">{r.title ?? "—"}</td>
                              <td className="px-2 py-1.5">{canAssignOthers ? (r.agent ?? "Me") : "Me"}</td>
                              <td className="px-2 py-1.5">{r.portal ?? LISTING_PORTALS.find(p => p.value === portal)?.label}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {rows.length > 50 && <p className="text-[11px] text-muted-foreground">Showing the first 50.</p>}
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
            {result ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => { setResult(null); setText(""); }}>Import another file</Button>
                <Button size="sm" onClick={onClose}>Done</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" disabled={rows.length === 0 || importRows.isPending} onClick={run}>
                  {importRows.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin me-1" />}
                  {progress ?? `Import ${rows.length} listing${rows.length === 1 ? "" : "s"}`}
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
