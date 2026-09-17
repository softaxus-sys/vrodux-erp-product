import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/crm/portal-listings`;

export type ListingPortal = "bayut" | "property-finder" | "dubizzle";

export const LISTING_PORTALS: { value: ListingPortal; label: string }[] = [
  { value: "bayut",           label: "Bayut" },
  { value: "property-finder", label: "Property Finder" },
  { value: "dubizzle",        label: "Dubizzle" },
];

export const portalLabel = (p: string) => LISTING_PORTALS.find(x => x.value === p)?.label ?? p;

/** A listing an agent registered as theirs — what routes a listing-only portal enquiry to them. */
export interface PortalListingDto {
  id: string;
  portal: ListingPortal;
  reference: string | null;
  listingId: string | null;
  url: string | null;
  title: string | null;
  agentUserId: string;
  agentName: string;
  teamId: string | null;
  isActive: boolean;
  enquiryCount: number;
  lastEnquiryAt: string | null;
  createdAt: string;
}

export interface CreatePortalListingRequest {
  portal: ListingPortal;
  reference?: string;
  url?: string;
  title?: string;
  /** Omit to register the listing to yourself. */
  agentUserId?: string;
  teamId?: string;
}

export interface UpdatePortalListingRequest {
  reference?: string;
  url?: string;
  title?: string;
  agentUserId: string;
  teamId?: string | null;
  isActive: boolean;
}

export interface PortalListingsParams {
  search?: string;
  portal?: string;
  mine?: boolean;
}

export interface ImportListingRow {
  reference?: string;
  url?: string;
  title?: string;
  /** Agent email or full name. Blank = the person importing. */
  agent?: string;
  /** Per-row portal; blank = the portal chosen for the whole file. */
  portal?: string;
}

export interface ImportListingsResult {
  created: number;
  skipped: number;
  errors: { row: number; listing: string | null; reason: string }[];
}

export const portalListingsApi = {
  getAll: (p: PortalListingsParams = {}): Promise<PortalListingDto[]> => {
    const q = new URLSearchParams();
    if (p.search) q.set("search", p.search);
    if (p.portal) q.set("portal", p.portal);
    if (p.mine) q.set("mine", "true");
    const qs = q.toString();
    return rawApiClient.get(qs ? `${BASE}?${qs}` : BASE);
  },
  create: (body: CreatePortalListingRequest): Promise<PortalListingDto> => rawApiClient.post(BASE, body),
  update: (id: string, body: UpdatePortalListingRequest): Promise<PortalListingDto> =>
    rawApiClient.put(`${BASE}/${id}`, body),
  remove: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/${id}`),
  importRows: (portal: ListingPortal, rows: ImportListingRow[]): Promise<ImportListingsResult> =>
    rawApiClient.post(`${BASE}/import`, { portal, rows }),
};

/**
 * The numeric listing id inside a portal URL — mirrors the server's extraction so the form can show
 * what will actually be matched before the agent saves.
 */
export const listingIdFromUrl = (v: string) =>
  v.match(/(?:details-|\/pm\/|\/property\/|listing[_-]?id=)(\d{4,12})/i)?.[1]
  ?? v.match(/-(\d{6,12})\.html\b/i)?.[1]
  ?? null;
