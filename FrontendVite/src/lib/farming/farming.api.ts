import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/farming`;

/** Today on this device (yyyy-MM-dd, local). The server clock is UTC, so dated calls send it. */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ── Vocabulary ──────────────────────────────────────────────────────────────

export const FARM_TYPES = [
  { value: "dairy",      label: "Dairy",        individual: true,  products: ["milk", "animals", "manure"], unitKind: "barn" },
  { value: "poultry",    label: "Poultry",      individual: false, products: ["eggs", "meat", "animals", "manure"], unitKind: "shed" },
  { value: "fish",       label: "Fish farming", individual: false, products: ["fish"], unitKind: "pond" },
  { value: "goat_sheep", label: "Goat & sheep", individual: true,  products: ["milk", "meat", "wool", "animals"], unitKind: "pen" },
  { value: "cattle",     label: "Beef cattle",  individual: true,  products: ["meat", "animals", "manure"], unitKind: "pen" },
  { value: "crops",      label: "Crops",        individual: false, products: ["crop"], unitKind: "field" },
  { value: "beekeeping", label: "Beekeeping",   individual: false, products: ["honey", "other"], unitKind: "apiary" },
  { value: "other",      label: "Other",        individual: false, products: ["other"], unitKind: "other" },
] as const;
export const farmTypeLabel = (t: string) => FARM_TYPES.find(x => x.value === t)?.label ?? t;

export const PRODUCTS: { value: string; label: string; uom: string }[] = [
  { value: "milk", label: "Milk", uom: "L" }, { value: "eggs", label: "Eggs", uom: "pcs" },
  { value: "fish", label: "Fish", uom: "kg" }, { value: "meat", label: "Meat", uom: "kg" },
  { value: "wool", label: "Wool", uom: "kg" }, { value: "honey", label: "Honey", uom: "kg" },
  { value: "crop", label: "Crop / harvest", uom: "kg" }, { value: "manure", label: "Manure", uom: "kg" },
  { value: "animals", label: "Live animals", uom: "head" }, { value: "other", label: "Other", uom: "pcs" },
];
export const productLabel = (p: string) => PRODUCTS.find(x => x.value === p)?.label ?? p;
export const defaultUom = (p: string) => PRODUCTS.find(x => x.value === p)?.uom ?? "pcs";
export const UNIT_KINDS = ["barn", "shed", "pen", "pond", "tank", "cage", "field", "greenhouse", "apiary", "other"];

const META: Record<string, { color: string; bg: string; label: string }> = {
  active:  { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/40", label: "Active" },
  sold:    { color: "text-blue-700 dark:text-blue-300",       bg: "bg-blue-100 dark:bg-blue-900/40",       label: "Sold" },
  dead:    { color: "text-red-700 dark:text-red-300",         bg: "bg-red-100 dark:bg-red-900/40",         label: "Dead" },
  culled:  { color: "text-amber-700 dark:text-amber-300",     bg: "bg-amber-100 dark:bg-amber-900/40",     label: "Culled" },
  closed:  { color: "text-slate-600 dark:text-slate-300",     bg: "bg-slate-100 dark:bg-slate-800",        label: "Closed" },
  pending: { color: "text-amber-700 dark:text-amber-300",     bg: "bg-amber-100 dark:bg-amber-900/40",     label: "Pending" },
  born:    { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/40", label: "Born" },
  failed:  { color: "text-red-700 dark:text-red-300",         bg: "bg-red-100 dark:bg-red-900/40",         label: "Failed" },
  overdue: { color: "text-red-700 dark:text-red-300",         bg: "bg-red-100 dark:bg-red-900/40",         label: "Overdue" },
  due:     { color: "text-amber-700 dark:text-amber-300",     bg: "bg-amber-100 dark:bg-amber-900/40",     label: "Due" },
  paid:    { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/40", label: "Paid" },
  unpaid:  { color: "text-amber-700 dark:text-amber-300",     bg: "bg-amber-100 dark:bg-amber-900/40",     label: "Unpaid" },
};
export const statusMeta = (s: string) => META[s] ?? { color: "text-muted-foreground", bg: "bg-muted", label: s.replace(/_/g, " ") };

// ── Types ───────────────────────────────────────────────────────────────────

export interface FarmSettingsDto { enabledTypes: string[]; milkUnit: string; }
export interface FarmDto { id: string; name: string; location?: string; areaAcres: number; manager?: string; phone?: string; notes?: string; unitCount: number; }
export interface FarmUnitDto { id: string; farmId: string; farmName?: string; name: string; type: string; kind: string; capacity: number; notes?: string; isActive: boolean; headCount: number; }
export interface AnimalDto { id: string; tagNumber: string; name?: string; type: string; species?: string; breed?: string; sex: string; birthDate?: string; unitId?: string; unitName?: string; damId?: string; damTag?: string; sireId?: string; sireTag?: string; source: string; acquiredOn?: string; purchasePrice: number; status: string; statusDate?: string; statusReason?: string; notes?: string; lastWeightKg?: number; production30d: number; pregnantDueOn?: string; withdrawalUntil?: string; }
export interface BatchDto { id: string; code: string; type: string; species?: string; breed?: string; unitId?: string; unitName?: string; startDate: string; initialCount: number; deaths: number; sold: number; currentCount: number; area: number; initialCost: number; expectedEndDate?: string; status: string; closedOn?: string; notes?: string; ageDays: number; mortalityPct: number; feedQty: number; feedCost: number; productionQty: number; latestWeightKg?: number; fcr?: number; salesTotal: number; }
export interface BreedingDto { id: string; animalId: string; animalTag?: string; serviceDate: string; method: string; sireId?: string; sireTag?: string; sireNote?: string; expectedOn?: string; outcome: string; outcomeOn?: string; offspring: number; notes?: string; }
export interface WeightDto { id: string; date: string; animalId?: string; batchId?: string; weightKg: number; sampleSize: number; notes?: string; }
export interface ProductionDto { id: string; date: string; type: string; product: string; quantity: number; uom: string; session?: string; grade?: string; rejected: number; animalId?: string; animalTag?: string; batchId?: string; batchCode?: string; unitId?: string; unitName?: string; notes?: string; recordedByName?: string; }
export interface FeedDto { id: string; date: string; feedName: string; quantity: number; uom: string; cost: number; animalId?: string; animalTag?: string; batchId?: string; batchCode?: string; unitId?: string; unitName?: string; notes?: string; }
export interface HealthDto { id: string; date: string; kind: string; title: string; medicine?: string; dose?: string; vetName?: string; cost: number; nextDueOn?: string; withdrawalDays: number; withdrawalUntil?: string; animalId?: string; animalTag?: string; batchId?: string; batchCode?: string; notes?: string; overdue: boolean; }
export interface MortalityDto { id: string; date: string; animalId?: string; animalTag?: string; batchId?: string; batchCode?: string; count: number; cause?: string; notes?: string; recordedByName?: string; }
export interface SaleDto { id: string; date: string; type: string; product: string; buyer?: string; buyerPhone?: string; quantity: number; uom: string; unitPrice: number; total: number; amountPaid: number; balance: number; animalId?: string; animalTag?: string; batchId?: string; batchCode?: string; headCount: number; notes?: string; }
export interface ExpenseDto { id: string; date: string; category: string; description: string; amount: number; type?: string; unitId?: string; unitName?: string; batchId?: string; batchCode?: string; paidTo?: string; }
export interface AnimalDetailDto { animal: AnimalDto; production: ProductionDto[]; health: HealthDto[]; breeding: BreedingDto[]; weights: WeightDto[]; offspring: AnimalDto[]; }
export interface FarmDashboardDto {
  enabledTypes: string[]; activeAnimals: number; activeBatches: number; headInBatches: number;
  animalsByType: { name: string; value: number }[]; headByType: { name: string; value: number }[];
  production: { product: string; uom: string; today: number; last30Days: number }[];
  milkTrend: { date: string; value: number }[]; eggTrend: { date: string; value: number }[];
  sales30d: number; unpaid: number; feedCost30d: number; healthCost30d: number; otherCost30d: number; profit30d: number; deaths30d: number;
  alerts: { kind: string; text: string; date?: string; animalId?: string; batchId?: string }[];
}

type Body = Record<string, unknown>;

// ── Client ──────────────────────────────────────────────────────────────────

const get = <T,>(path: string) => rawApiClient.get<T>(`${BASE}${path}`);
const post = <T,>(path: string, body?: unknown) => rawApiClient.post<T>(`${BASE}${path}`, body ?? {});
const put = <T,>(path: string, body?: unknown) => rawApiClient.put<T>(`${BASE}${path}`, body ?? {});
const del = (path: string) => rawApiClient.delete<void>(`${BASE}${path}`);
const save = <T,>(path: string, id: string | undefined, b: Body) => id ? put<T>(`${path}/${id}`, b) : post<T>(path, b);

export const farmingApi = {
  settings: () => get<FarmSettingsDto>("/settings"),
  updateSettings: (b: { enabledTypes: string[]; milkUnit?: string }) => put<FarmSettingsDto>("/settings", b),
  farms: () => get<FarmDto[]>("/farms"),
  saveFarm: (id: string | undefined, b: Body) => save<FarmDto>("/farms", id, b),
  deleteFarm: (id: string) => del(`/farms/${id}`),
  units: (q: { farmId?: string; type?: string } = {}) => get<FarmUnitDto[]>(`/units${qs(q)}`),
  saveUnit: (id: string | undefined, b: Body) => save<FarmUnitDto>("/units", id, b),
  deleteUnit: (id: string) => del(`/units/${id}`),
  dashboard: () => get<FarmDashboardDto>(`/dashboard${qs({ today: localToday() })}`),

  animals: (q: { type?: string; status?: string; unitId?: string; search?: string } = {}) => get<AnimalDto[]>(`/animals${qs({ ...q, today: localToday() })}`),
  animal: (id: string) => get<AnimalDetailDto>(`/animals/${id}${qs({ today: localToday() })}`),
  saveAnimal: (id: string | undefined, b: Body) => save<AnimalDto>("/animals", id, b),
  animalStatus: (id: string, b: { status: string; date?: string; reason?: string }) => post<AnimalDto>(`/animals/${id}/status`, { id, ...b }),
  deleteAnimal: (id: string) => del(`/animals/${id}`),
  batches: (q: { type?: string; status?: string } = {}) => get<BatchDto[]>(`/batches${qs({ ...q, today: localToday() })}`),
  saveBatch: (id: string | undefined, b: Body) => save<BatchDto>("/batches", id, b),
  closeBatch: (id: string, reopen: boolean) => post<BatchDto>(`/batches/${id}/close`, { id, on: localToday(), reopen }),
  deleteBatch: (id: string) => del(`/batches/${id}`),
  breeding: (q: { animalId?: string; pendingOnly?: boolean } = {}) => get<BreedingDto[]>(`/breeding${qs(q)}`),
  saveBreeding: (id: string | undefined, b: Body) => save<BreedingDto>("/breeding", id, b),
  breedingOutcome: (id: string, b: { outcome: string; on?: string; offspring: number }) => post<BreedingDto>(`/breeding/${id}/outcome`, { id, ...b }),
  deleteBreeding: (id: string) => del(`/breeding/${id}`),
  addWeight: (b: Body) => post<WeightDto>("/weights", b),
  deleteWeight: (id: string) => del(`/weights/${id}`),

  production: (q: { from?: string; to?: string; type?: string; product?: string; animalId?: string; batchId?: string }) => get<ProductionDto[]>(`/production${qs(q)}`),
  saveProduction: (id: string | undefined, b: Body) => save<ProductionDto>("/production", id, b),
  bulkProduction: (b: { date: string; product: string; uom: string; session?: string; entries: { animalId: string; quantity: number }[] }) => post<number>("/production/bulk", b),
  deleteProduction: (id: string) => del(`/production/${id}`),
  feed: (q: { from?: string; to?: string; batchId?: string; unitId?: string }) => get<FeedDto[]>(`/feed${qs(q)}`),
  saveFeed: (id: string | undefined, b: Body) => save<FeedDto>("/feed", id, b),
  deleteFeed: (id: string) => del(`/feed/${id}`),

  health: (q: { from?: string; to?: string; kind?: string; animalId?: string; batchId?: string; dueOnly?: boolean }) => get<HealthDto[]>(`/health${qs({ ...q, today: localToday() })}`),
  saveHealth: (id: string | undefined, b: Body) => save<HealthDto>("/health", id, b),
  healthDone: (id: string) => post<void>(`/health/${id}/done`),
  deleteHealth: (id: string) => del(`/health/${id}`),
  mortality: (q: { from?: string; to?: string; batchId?: string }) => get<MortalityDto[]>(`/mortality${qs(q)}`),
  addMortality: (b: Body) => post<MortalityDto>("/mortality", b),
  deleteMortality: (id: string) => del(`/mortality/${id}`),

  sales: (q: { from?: string; to?: string; type?: string; product?: string; unpaidOnly?: boolean }) => get<SaleDto[]>(`/sales${qs(q)}`),
  saveSale: (id: string | undefined, b: Body) => save<SaleDto>("/sales", id, b),
  deleteSale: (id: string) => del(`/sales/${id}`),
  expenses: (q: { from?: string; to?: string; category?: string }) => get<ExpenseDto[]>(`/expenses${qs(q)}`),
  saveExpense: (id: string | undefined, b: Body) => save<ExpenseDto>("/expenses", id, b),
  deleteExpense: (id: string) => del(`/expenses/${id}`),
};
