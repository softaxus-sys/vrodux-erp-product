/**
 * File Manager -- browses the CRM document library (contracts, proposals, signed agreements, ID
 * copies attached to leads/opportunities/accounts/contacts). CRM is the only document store in
 * this codebase today -- HR holds a single receipt blob per expense, Visa's CaseDocument stores a
 * URL not a file, every other module has no file storage at all (CLAUDE.md Module 26) -- so this
 * screen has exactly one library, not a module picker.
 */

export type CrmDocumentTarget = "lead" | "deal" | "customer" | "contact";

export const RELATED_TO_LABELS: Record<CrmDocumentTarget, string> = {
  lead: "Lead",
  deal: "Opportunity",
  customer: "Account",
  contact: "Contact",
};

export interface CrmDocumentDto {
  id: string;
  relatedToType: CrmDocumentTarget;
  relatedToId: string;
  relatedToName: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  documentType: string;
  description: string | null;
  uploadedByName: string | null;
  createdAt: string;
  /** Owner of the record the document hangs off (the rep whose lead/deal/account this is), not
   *  whoever uploaded it -- this is what folders group by. Null when the record is unassigned. */
  ownerUserId: string | null;
  ownerName: string | null;
}

/** Suggested categories -- the backend accepts any string up to 40 chars, so a tenant-defined one
 *  falls back to a title-cased render of the raw value rather than "unknown". */
export const DOCUMENT_TYPES = [
  "contract",
  "proposal",
  "quotation",
  "agreement",
  "invoice",
  "id_document",
  "trade_license",
  "presentation",
  "other",
] as const;

export function documentTypeLabel(value: string): string {
  const known: Record<string, string> = {
    contract: "Contract",
    proposal: "Proposal",
    quotation: "Quotation",
    agreement: "Agreement",
    invoice: "Invoice",
    id_document: "ID Document",
    trade_license: "Trade License",
    presentation: "Presentation",
    other: "Other",
  };
  return known[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
