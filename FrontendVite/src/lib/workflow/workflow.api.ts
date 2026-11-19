import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/workflow`;

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ── Form definitions ────────────────────────────────────────────────────────

export type FieldType = "text" | "textarea" | "number" | "money" | "date" | "select" | "checkbox" | "attachment" | "lines";
export interface ColumnDef { key: string; label: string; type: string; required?: boolean; options?: string[] | null; product?: string[] | null; isAmount?: boolean }
export interface ShowIf { field: string; in: string[] }
export interface FieldDef {
  key: string; label: string; type: FieldType; required?: boolean; options?: string[] | null; help?: string | null;
  isAmount?: boolean; isTitle?: boolean; showIf?: ShowIf | null; columns?: ColumnDef[] | null; placeholder?: string | null;
}

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" }, { value: "textarea", label: "Long text" }, { value: "number", label: "Number" },
  { value: "money", label: "Amount of money" }, { value: "date", label: "Date" }, { value: "select", label: "Choice list" },
  { value: "checkbox", label: "Yes / no tick" }, { value: "attachment", label: "File upload" }, { value: "lines", label: "Table of rows" },
];

export const parseFields = (json: string): FieldDef[] => { try { return JSON.parse(json) as FieldDef[]; } catch { return []; } };

// ── Status vocabulary ───────────────────────────────────────────────────────

export const STATUS_META: Record<string, { label: string; tone: string }> = {
  draft:     { label: "Draft",     tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  pending:   { label: "In approval", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  approved:  { label: "Approved",  tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected:  { label: "Rejected",  tone: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  cancelled: { label: "Cancelled", tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  waiting:   { label: "Not reached", tone: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  skipped:   { label: "Skipped",   tone: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
};
export const statusMeta = (s: string) => STATUS_META[s] ?? { label: s, tone: "bg-slate-100 text-slate-700" };

// ── DTOs ────────────────────────────────────────────────────────────────────

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
export interface WfSettings {
  locationLabel: string; unitLabel: string; directoryRefresh: string; directoryRefreshedAt: string | null;
  timeZoneId: string; numberPrefix: string; starterPack: string | null;
}
export interface MyBase { id: string; code: string; name: string }
export interface WfUnit { id: string; name: string; code: string | null; sortOrder: number; isActive: boolean }
export interface MyContext {
  settings: WfSettings; bases: MyBase[]; units: WfUnit[]; isAdmin: boolean; seesAll: boolean; canCreate: boolean;
  canApprove: boolean; setupDone: boolean; userId: string | null; userName: string | null;
}
export interface WfBase { id: string; code: string; name: string; country: string | null; sortOrder: number; isActive: boolean; userCount: number }
export interface Position { id: string; name: string; description: string | null; isActive: boolean; holderCount: number; flowCount: number }
export interface Holder {
  id: string; positionId: string; positionName: string; baseId: string | null; baseName: string | null; unitId: string | null;
  unitName: string | null; userId: string; userName: string; email: string | null; designation: string | null;
}
export interface AccessUser { userId: string; userName: string }
export interface WfForm {
  id: string; key: string; name: string; description: string | null; category: string | null; icon: string | null;
  fieldsJson: string; version: number; sortOrder: number; isActive: boolean; isBuiltIn: boolean; requestCount: number; flowCount: number;
}
export interface FlowStep { order: number; kind: string; positionId: string; positionName: string; label: string | null; minAmount: number | null }
export interface Flow {
  id: string; formId: string; formName: string; baseId: string | null; baseName: string | null; unitId: string | null;
  unitName: string | null; isActive: boolean; steps: FlowStep[];
}
export interface ResolvedStep {
  order: number; kind: string; positionName: string; label: string | null; minAmount: number | null; applies: boolean;
  holders: { userId: string; name: string; designation: string | null }[]; problem: string | null;
}
export interface ResolvedFlow { flowId: string | null; scope: string; steps: ResolvedStep[]; problems: string[] }
export interface StarterPackStatus { installed: string | null; available: { key: string; name: string; description: string }[] }

export interface RequestSummary {
  id: string; number: string; formId: string; formName: string; formKey: string; baseId: string; baseName: string;
  unitName: string | null; title: string | null; amount: number; status: string; requesterId: string; requesterName: string;
  createdAt: string; submittedAt: string | null; completedAt: string | null; waitingOn: string | null; waitingStep: string | null;
  stepsDone: number; stepsTotal: number; waitingOnMe: boolean; waitingSince: string | null;
}
export interface RequestStep {
  id: string; order: number; kind: string; positionName: string; label: string | null; status: string;
  assignees: { userId: string; name: string; designation: string | null }[]; decidedByName: string | null;
  decidedByDesignation: string | null; decidedAt: string | null; comment: string | null; skipReason: string | null;
  hasPdf: boolean; activatedAt: string | null;
}
export interface Attachment { id: string; fieldKey: string | null; fileName: string; contentType: string; size: number; uploadedByName: string; createdAt: string }
export interface Comment { id: string; authorId: string; authorName: string; text: string; createdAt: string }
export interface TimelineItem { at: string; userName: string | null; action: string; detail: string | null }
export interface RequestDetail {
  id: string; number: string; formId: string; formName: string; formKey: string; formVersion: number; fieldsJson: string;
  baseId: string; baseName: string; unitId: string | null; unitName: string | null; title: string | null; dataJson: string;
  amount: number; status: string; requesterId: string; requesterName: string; requesterEmail: string | null;
  requesterDesignation: string | null; createdAt: string; submittedAt: string | null; completedAt: string | null;
  finalReason: string | null; resubmittedFromId: string | null; steps: RequestStep[]; attachments: Attachment[];
  comments: Comment[]; timeline: TimelineItem[]; canDecide: boolean; currentStepId: string | null; canEdit: boolean;
  canCancel: boolean; canReassign: boolean; canResubmit: boolean;
}
export interface SaveRequestInput { id?: string | null; formId: string; baseId: string; unitId?: string | null; title?: string | null; data: Record<string, unknown>; submit: boolean }

export interface DocType { id: string; name: string; frequency: "daily" | "monthly"; description: string | null; sortOrder: number; isActive: boolean; templateName: string | null }
export interface RepoDoc {
  id: string; docTypeId: string; docTypeName: string; baseId: string; baseName: string; periodDate: string; fileName: string;
  contentType: string; size: number; notes: string | null; uploadedByName: string; createdAt: string;
}
export interface Calendar { month: string; baseId: string; docTypes: DocType[]; cells: { docTypeId: string; date: string; count: number }[] }
export interface Employee {
  id: string; code: string | null; name: string; email: string | null; phone: string | null; designation: string | null;
  department: string | null; managerName: string | null; baseId: string | null; baseName: string | null; unitId: string | null;
  unitName: string | null; isActive: boolean; source: string; lastSyncedAt: string | null; hasLogin: boolean;
}
export interface EmployeeRow { code?: string; name?: string; email?: string; phone?: string; designation?: string; department?: string; manager?: string; base?: string; unit?: string }
export interface AuditEntry {
  id: string; at: string; userId: string | null; userName: string | null; action: string; entityType: string; entityId: string | null;
  requestId: string | null; requestNumber: string | null; detail: string | null; ip: string | null;
}
export interface Dashboard {
  myOpen: number; toApprove: number; approvedLast30: number; rejectedLast30: number; avgHoursToDecision: number;
  byForm: { label: string; count: number }[]; byBase: { label: string; count: number }[]; byStatus: { label: string; count: number }[];
  overdueOver48h: number;
}

// ── Calls ───────────────────────────────────────────────────────────────────

/** Fetches a protected file and opens it in a new tab (PDFs, images) or saves it. */
async function openFile(url: string, fallbackName: string, save = false) {
  const { blob, fileName } = await rawApiClient.getBlob(url);
  const href = URL.createObjectURL(blob);
  if (save || !/pdf|image/.test(blob.type)) {
    const a = document.createElement("a");
    a.href = href; a.download = fileName ?? fallbackName; document.body.appendChild(a); a.click(); a.remove();
  } else window.open(href, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export const workflowApi = {
  context: () => rawApiClient.get<MyContext>(`${BASE}/context`),
  settings: () => rawApiClient.get<WfSettings>(`${BASE}/settings`),
  updateSettings: (b: { locationLabel: string; unitLabel: string; directoryRefresh: string; timeZoneId: string; numberPrefix: string }) =>
    rawApiClient.put<WfSettings>(`${BASE}/settings`, b),

  bases: () => rawApiClient.get<WfBase[]>(`${BASE}/bases`),
  saveBase: (b: { id?: string | null; code: string; name: string; country?: string | null; sortOrder: number; isActive: boolean }) =>
    b.id ? rawApiClient.put<WfBase>(`${BASE}/bases/${b.id}`, b) : rawApiClient.post<WfBase>(`${BASE}/bases`, b),
  deleteBase: (id: string) => rawApiClient.delete<void>(`${BASE}/bases/${id}`),
  baseAccess: (id: string) => rawApiClient.get<{ baseId: string; users: AccessUser[] }>(`${BASE}/bases/${id}/access`),
  setBaseAccess: (id: string, users: AccessUser[]) => rawApiClient.put<{ baseId: string; users: AccessUser[] }>(`${BASE}/bases/${id}/access`, users),

  units: () => rawApiClient.get<WfUnit[]>(`${BASE}/units`),
  saveUnit: (b: { id?: string | null; name: string; code?: string | null; sortOrder: number; isActive: boolean }) =>
    b.id ? rawApiClient.put<WfUnit>(`${BASE}/units/${b.id}`, b) : rawApiClient.post<WfUnit>(`${BASE}/units`, b),
  deleteUnit: (id: string) => rawApiClient.delete<void>(`${BASE}/units/${id}`),

  positions: () => rawApiClient.get<Position[]>(`${BASE}/positions`),
  savePosition: (b: { id?: string | null; name: string; description?: string | null; isActive: boolean }) =>
    b.id ? rawApiClient.put<Position>(`${BASE}/positions/${b.id}`, b) : rawApiClient.post<Position>(`${BASE}/positions`, b),
  deletePosition: (id: string) => rawApiClient.delete<void>(`${BASE}/positions/${id}`),
  holders: (positionId?: string) => rawApiClient.get<Holder[]>(`${BASE}/holders${qs({ positionId })}`),
  saveHolder: (b: { id?: string | null; positionId: string; baseId?: string | null; unitId?: string | null; userId: string; userName: string; email?: string | null; designation?: string | null }) =>
    b.id ? rawApiClient.put<Holder>(`${BASE}/holders/${b.id}`, b) : rawApiClient.post<Holder>(`${BASE}/holders`, b),
  deleteHolder: (id: string) => rawApiClient.delete<void>(`${BASE}/holders/${id}`),

  forms: (all = false) => rawApiClient.get<WfForm[]>(`${BASE}/forms${all ? "?all=true" : ""}`),
  form: (id: string) => rawApiClient.get<WfForm>(`${BASE}/forms/${id}`),
  saveForm: (b: { id?: string | null; name: string; description?: string | null; category?: string | null; icon?: string | null; fieldsJson: string; sortOrder: number; isActive: boolean }) =>
    b.id ? rawApiClient.put<WfForm>(`${BASE}/forms/${b.id}`, b) : rawApiClient.post<WfForm>(`${BASE}/forms`, b),
  duplicateForm: (id: string) => rawApiClient.post<WfForm>(`${BASE}/forms/${id}/duplicate`),
  deleteForm: (id: string) => rawApiClient.delete<void>(`${BASE}/forms/${id}`),

  flows: (formId?: string) => rawApiClient.get<Flow[]>(`${BASE}/flows${qs({ formId })}`),
  saveFlow: (b: { id?: string | null; formId: string; baseId?: string | null; unitId?: string | null; isActive: boolean; steps: { kind: string; positionId: string; label?: string | null; minAmount?: number | null }[] }) =>
    b.id ? rawApiClient.put<Flow>(`${BASE}/flows/${b.id}`, b) : rawApiClient.post<Flow>(`${BASE}/flows`, b),
  deleteFlow: (id: string) => rawApiClient.delete<void>(`${BASE}/flows/${id}`),
  resolve: (q: { formId: string; baseId: string; unitId?: string | null; amount?: number }) => rawApiClient.get<ResolvedFlow>(`${BASE}/flows/resolve${qs(q)}`),
  starterPack: () => rawApiClient.get<StarterPackStatus>(`${BASE}/starter-pack`),
  installStarterPack: (key: string) => rawApiClient.post<StarterPackStatus>(`${BASE}/starter-pack/${key}`),

  employees: (q: { search?: string; baseId?: string; active?: boolean; page?: number; pageSize?: number } = {}) =>
    rawApiClient.get<Paged<Employee>>(`${BASE}/employees${qs(q)}`),
  saveEmployee: (b: Partial<Employee> & { name: string; isActive: boolean }) =>
    b.id ? rawApiClient.put<Employee>(`${BASE}/employees/${b.id}`, b) : rawApiClient.post<Employee>(`${BASE}/employees`, b),
  deleteEmployee: (id: string) => rawApiClient.delete<void>(`${BASE}/employees/${id}`),
  importEmployees: (rows: EmployeeRow[], isFullList: boolean) =>
    rawApiClient.post<{ created: number; updated: number; deactivated: number; failed: number; errors: { row: number; reason: string }[] }>(
      `${BASE}/employees/import`, { rows, isFullList }),

  audit: (q: { from?: string; to?: string; userId?: string; action?: string; requestId?: string; search?: string; page?: number; pageSize?: number }) =>
    rawApiClient.get<Paged<AuditEntry>>(`${BASE}/audit${qs(q)}`),
  dashboard: () => rawApiClient.get<Dashboard>(`${BASE}/dashboard`),

  // Requests
  requests: (q: { scope?: string; status?: string; baseId?: string; formId?: string; search?: string; from?: string; to?: string; page?: number; pageSize?: number }) =>
    rawApiClient.get<Paged<RequestSummary>>(`${BASE}/requests${qs(q)}`),
  request: (id: string) => rawApiClient.get<RequestDetail>(`${BASE}/requests/${id}`),
  saveRequest: (b: SaveRequestInput) =>
    b.id ? rawApiClient.put<RequestDetail>(`${BASE}/requests/${b.id}`, b) : rawApiClient.post<RequestDetail>(`${BASE}/requests`, b),
  submitRequest: (id: string) => rawApiClient.post<RequestDetail>(`${BASE}/requests/${id}/submit`),
  decide: (id: string, action: "approve" | "reject", comment?: string) => rawApiClient.post<RequestDetail>(`${BASE}/requests/${id}/decide`, { action, comment }),
  cancelRequest: (id: string, reason?: string) => rawApiClient.post<RequestDetail>(`${BASE}/requests/${id}/cancel`, { reason }),
  deleteRequest: (id: string) => rawApiClient.delete<void>(`${BASE}/requests/${id}`),
  resubmit: (id: string) => rawApiClient.post<RequestDetail>(`${BASE}/requests/${id}/resubmit`),
  comment: (id: string, text: string) => rawApiClient.post<RequestDetail>(`${BASE}/requests/${id}/comments`, { text }),
  reassign: (id: string, stepId: string, users: AccessUser[], reason: string) =>
    rawApiClient.post<RequestDetail>(`${BASE}/requests/${id}/steps/${stepId}/reassign`, { users, reason }),
  uploadAttachment: (id: string, file: File, fieldKey?: string) => {
    const f = new FormData(); f.append("file", file); if (fieldKey) f.append("fieldKey", fieldKey);
    return rawApiClient.postForm<Attachment>(`${BASE}/requests/${id}/attachments`, f);
  },
  deleteAttachment: (id: string, attId: string) => rawApiClient.delete<void>(`${BASE}/requests/${id}/attachments/${attId}`),
  openAttachment: (id: string, a: Attachment) => openFile(`${BASE}/requests/${id}/attachments/${a.id}`, a.fileName),
  openStepPdf: (id: string, stepId: string) => openFile(`${BASE}/requests/${id}/steps/${stepId}/pdf`, "decision.pdf"),
  openRequestPdf: (id: string) => openFile(`${BASE}/requests/${id}/pdf`, "request.pdf"),

  // Repository
  docTypes: () => rawApiClient.get<DocType[]>(`${BASE}/repository/types`),
  saveDocType: (b: { id?: string | null; name: string; frequency: string; description?: string | null; sortOrder: number; isActive: boolean }) =>
    b.id ? rawApiClient.put<DocType>(`${BASE}/repository/types/${b.id}`, b) : rawApiClient.post<DocType>(`${BASE}/repository/types`, b),
  deleteDocType: (id: string) => rawApiClient.delete<void>(`${BASE}/repository/types/${id}`),
  setTemplate: (id: string, file: File) => { const f = new FormData(); f.append("file", file); return rawApiClient.postForm<DocType>(`${BASE}/repository/types/${id}/template`, f); },
  removeTemplate: (id: string) => rawApiClient.delete<DocType>(`${BASE}/repository/types/${id}/template`),
  openTemplate: (id: string) => openFile(`${BASE}/repository/types/${id}/template`, "template", true),
  calendar: (baseId: string, month: string) => rawApiClient.get<Calendar>(`${BASE}/repository/calendar${qs({ baseId, month })}`),
  repoDocs: (q: { baseId?: string; docTypeId?: string; from?: string; to?: string; search?: string; page?: number; pageSize?: number }) =>
    rawApiClient.get<Paged<RepoDoc>>(`${BASE}/repository/documents${qs(q)}`),
  uploadRepoDoc: (b: { docTypeId: string; baseId: string; periodDate: string; notes?: string; file: File }) => {
    const f = new FormData();
    f.append("docTypeId", b.docTypeId); f.append("baseId", b.baseId); f.append("periodDate", b.periodDate);
    if (b.notes) f.append("notes", b.notes); f.append("file", b.file);
    return rawApiClient.postForm<RepoDoc>(`${BASE}/repository/documents`, f);
  },
  deleteRepoDoc: (id: string) => rawApiClient.delete<void>(`${BASE}/repository/documents/${id}`),
  openRepoDoc: (d: RepoDoc) => openFile(`${BASE}/repository/documents/${d.id}/file`, d.fileName),
};

// ── Formatting ──────────────────────────────────────────────────────────────

export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const s = /Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : /Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};
export const fmtMoney = (n: number | null | undefined) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const ago = (iso: string | null | undefined) => {
  if (!iso) return "";
  const s = /Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  const h = (Date.now() - new Date(s).getTime()) / 3_600_000;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);

/** What an audit action means in plain words. Unknown actions fall back to the raw key. */
export const ACTION_LABELS: Record<string, string> = {
  "request.created": "Created a request", "request.draft.saved": "Saved a draft", "request.submitted": "Submitted a request",
  "request.approved": "Approved", "request.rejected": "Rejected", "request.completed": "Request fully approved",
  "request.cancelled": "Cancelled a request", "request.commented": "Commented", "request.reassigned": "Reassigned an approval",
  "request.viewed": "Opened a request", "request.draft.deleted": "Deleted a draft", "request.resubmit.started": "Started again from a rejected request",
  "attachment.added": "Attached a file", "attachment.removed": "Removed a file", "attachment.downloaded": "Downloaded a file", "pdf.downloaded": "Downloaded a PDF",
  "repository.uploaded": "Filed a document", "repository.deleted": "Removed a document", "repository.downloaded": "Downloaded a document",
  "form.created": "Created a form", "form.updated": "Changed a form", "form.deleted": "Deleted a form", "form.duplicated": "Copied a form",
  "flow.created": "Created an approval flow", "flow.updated": "Changed an approval flow", "flow.deleted": "Deleted an approval flow",
  "position.holder.set": "Assigned someone to a position", "position.holder.removed": "Removed someone from a position",
  "base.access.set": "Changed who can use a location", "user.bases.set": "Changed a person's locations",
  "directory.imported": "Refreshed the employee directory", "starterpack.installed": "Installed a starter pack", "settings.updated": "Changed settings",
};
export const actionLabel = (a: string) => ACTION_LABELS[a] ?? a.replace(/[._]/g, " ");
