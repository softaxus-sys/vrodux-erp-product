import * as React from "react";
import { motion } from "framer-motion";
import { X, UploadCloud, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAssignableByTeam } from "@/hooks/identity/use-assignable-by-team";

/**
 * Bulk import of listing reference → agent.
 *
 * This is the mapping Bayut themselves point to: a WhatsApp push carries the Listing Reference
 * Number and nothing about the agent, and since the reference is unique and the listings are the
 * agency's own, the agency already knows who published each one. Their alternative — the Listings
 * API — is an all-or-nothing switch that disables manual listing management in Profolio, which is
 * far too much to give up for lead routing.
 *
 * Entering hundreds of references by hand is not realistic, so this takes the export the agency
 * already has (Profolio, their XML feed, a spreadsheet) and matches each agent to a login.
 *
 * Imported rows are PINNED, not learned: they came from the agency's own record of who published
 * what, so an enquiry that happens to name someone else must never quietly overwrite them.
 */

/**
 * The numeric listing id inside a Bayut URL, matching the server's own extraction.
 *
 * An export may give the reference ("100104-y1OGck"), the id ("16224883") or the listing URL — and
 * a push payload carries the reference AND a URL holding the id. Keying on only one of them is how
 * a map that looks complete silently matches nothing, so a URL row is stored under both.
 */
const listingIdFrom = (v: string) =>
  v.match(/(?:details-|\/pm\/|\/property\/|listing[_-]?id=)(\d{4,12})/i)?.[1] ?? null;

type Row = {
  reference: string;
  /** Second key for the same listing, when the cell was a URL. */
  alsoKey: string | null;
  agent: string;
  userId: string | null;
  userName: string | null;
  teamId: string | null;
  reason: string | null;
};

export interface ImportedListingRow {
  reference: string;
  userId: string;
  userName: string | null;
  teamId: string | null;
}

/** Splits a delimited line, honouring quoted fields (an agent name can contain a comma). */
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

/** Lower-cased letters and digits only — so "Al-Mansoori" matches "Al Mansoori", as on the server. */
const normalizeName = (s: string) =>
  s.replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase().replace(/\s+/g, " ");

const HEADER_REFERENCE = ["reference", "listing reference", "listing_reference", "ref", "reference number",
                          "listing reference number", "refno", "reference no"];
const HEADER_AGENT     = ["agent", "agent name", "agent_name", "agent email", "agent_email", "email",
                          "owner", "published by", "user", "listing agent"];

export function ListingMapImportModal({ onClose, onImport }: {
  onClose: () => void;
  onImport: (rows: ImportedListingRow[]) => void;
}) {
  const { options } = useAssignableByTeam(true);
  const [text, setText] = React.useState("");

  const rows = React.useMemo<Row[]>(() => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    // Tab first: a spreadsheet paste is tab-separated, and an agent name with a comma would be
    // split in the wrong place if comma won by default.
    const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";

    let refCol = 0, agentCol = 1, start = 0;
    const head = splitLine(lines[0], delimiter).map(h => h.toLowerCase());
    const foundRef   = head.findIndex(h => HEADER_REFERENCE.includes(h));
    const foundAgent = head.findIndex(h => HEADER_AGENT.includes(h));
    // A header row is only assumed when it actually names the columns; otherwise the first line is
    // data and dropping it would silently lose a listing.
    if (foundRef >= 0 && foundAgent >= 0) { refCol = foundRef; agentCol = foundAgent; start = 1; }

    const seen = new Set<string>();
    const out: Row[] = [];

    for (const line of lines.slice(start)) {
      const cells = splitLine(line, delimiter);
      const reference = (cells[refCol] ?? "").trim();
      const agent = (cells[agentCol] ?? "").trim();
      if (!reference) continue;
      // A reference is unique by definition, so a repeat is a duplicated export row, not a second
      // listing — keeping both would make the last one silently win.
      if (seen.has(reference.toLowerCase())) continue;
      seen.add(reference.toLowerCase());

      let match: typeof options[number] | undefined;
      let reason: string | null = null;

      if (!agent) {
        reason = "No agent in this row.";
      } else if (agent.includes("@")) {
        match = options.find(o => o.email?.toLowerCase() === agent.toLowerCase());
        if (!match) reason = `No login with the email ${agent}.`;
      } else {
        const wanted = normalizeName(agent);
        const hits = options.filter(o => normalizeName(o.fullName) === wanted);
        // Two people with the same name means the name identifies nobody; assigning one of them
        // would hand every one of those listings to the wrong person.
        if (hits.length === 1) match = hits[0];
        else reason = hits.length === 0 ? `No login named "${agent}".` : `More than one login named "${agent}".`;
      }

      out.push({
        reference,
        alsoKey: listingIdFrom(reference),
        agent,
        userId:   match?.id ?? null,
        userName: match?.fullName ?? null,
        teamId:   match?.teamId ?? null,
        reason,
      });
    }
    return out;
  }, [text, options]);

  const matched = rows.filter(r => r.userId);

  const apply = () => {
    onImport(matched.flatMap(r => {
      const entry = { userId: r.userId!, userName: r.userName, teamId: r.teamId };
      return r.alsoKey && r.alsoKey !== r.reference
        ? [{ reference: r.reference, ...entry }, { reference: r.alsoKey, ...entry }]
        : [{ reference: r.reference, ...entry }];
    }));
    onClose();
  };

  const readFile = async (file: File) => setText(await file.text());

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col pointer-events-auto shadow-xl">
          <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground">Import listing → agent</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Paste two columns — the listing and the agent who published it — or drop a CSV.
                The listing can be its reference, its numeric id, or its URL. Bayut's WhatsApp leads
                carry only the listing, so this map is what routes them to the right agent.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="text-[11px] text-muted-foreground">Paste rows</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder={"Reference,Agent\n100104-y1OGck,Lorena Ortega\n100104-uDkDxP,ahmed@agency.ae"}
                className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-primary cursor-pointer hover:underline">
              <UploadCloud className="h-3.5 w-3.5" />
              Or choose a CSV file
              <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) void readFile(f); }} />
            </label>

            {rows.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 py-2">
                    <p className="text-base font-bold text-success leading-none">{matched.length}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Will be mapped</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 py-2">
                    <p className="text-base font-bold text-muted-foreground leading-none">{rows.length - matched.length}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">No matching login</p>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
                  {rows.map(r => (
                    <div key={r.reference} className="flex items-start gap-3 p-2.5 text-sm">
                      {r.userId
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs truncate">{r.reference}</p>
                        <p className={cn("text-[11px] truncate",
                          r.userId ? "text-success" : "text-muted-foreground")}>
                          {r.userId ? `${r.agent} → ${r.userName}` : r.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 p-4 border-t border-border">
            <p className="text-[11px] text-muted-foreground">
              Imported listings are pinned, so incoming enquiries never overwrite them.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" disabled={matched.length === 0} onClick={apply}>
                Map {matched.length} listing{matched.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
