/**
 * Create forms and one-tap "next step" actions for the industry packs (B2B, Education,
 * Healthcare, Insurance). Data-driven: one generic screen renders any of these.
 * Request shapes mirror the web app's `lib/<pack>/<pack>.api.ts`.
 */

export type FieldKind = "text" | "multiline" | "number" | "date" | "datetime" | "choice" | "lookup";

export interface VerticalField {
  /** Key in the request body. */
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: { value: string; label: string }[];
  default?: string;
  /** For `lookup`: the list to pick a record from, and which fields give its label / sub-line. */
  lookup?: { path: string; label: string; sub?: string };
  /** For `lookup`: also send the picked record's label under this body key. */
  labelAs?: string;
  /** Body value when left blank (default null). */
  blank?: "zero";
  /** Computed-from-today default, in days. */
  dateOffsetDays?: number;
}

export interface VerticalFormSpec {
  title: string;
  submitLabel: string;
  path: string;
  /** Query key prefix to refresh after saving. */
  queryKey: string;
  permission: string;
  fields: VerticalField[];
}

const opts = (...v: string[]) => v.map((x) => ({ value: x, label: x.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) }));

export const VERTICAL_FORMS: Record<string, VerticalFormSpec> = {
  // ── B2B ────────────────────────────────────────────────────────────────
  "b2b.proposal": {
    title: "New proposal", submitLabel: "Create proposal", path: "/api/b2b/proposals", queryKey: "b2b", permission: "b2b.proposals.create",
    fields: [
      { name: "clientName", label: "Client", kind: "text", required: true },
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "amount", label: "Amount", kind: "number", required: true },
      { name: "validUntil", label: "Valid until", kind: "date", required: true, dateOffsetDays: 30 },
      { name: "scope", label: "Scope", kind: "multiline" },
      { name: "notes", label: "Notes", kind: "multiline" },
    ],
  },
  "b2b.contract": {
    title: "New contract", submitLabel: "Create contract", path: "/api/b2b/contracts", queryKey: "b2b", permission: "b2b.contracts.create",
    fields: [
      { name: "clientName", label: "Client", kind: "text", required: true },
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "contractType", label: "Type", kind: "choice", default: "amc", options: opts("project", "amc", "retainer", "sla") },
      { name: "slaTier", label: "SLA tier", kind: "choice", default: "silver", options: opts("bronze", "silver", "gold", "platinum") },
      { name: "value", label: "Value", kind: "number", required: true },
      { name: "startDate", label: "Start", kind: "date", required: true, dateOffsetDays: 0 },
      { name: "endDate", label: "End", kind: "date", required: true, dateOffsetDays: 365 },
      { name: "notes", label: "Notes", kind: "multiline" },
    ],
  },
  "b2b.ticket": {
    title: "New support ticket", submitLabel: "Create ticket", path: "/api/b2b/tickets", queryKey: "b2b", permission: "b2b.tickets.create",
    fields: [
      { name: "clientName", label: "Client", kind: "text", required: true },
      { name: "subject", label: "Subject", kind: "text", required: true },
      { name: "priority", label: "Priority", kind: "choice", default: "medium", options: opts("low", "medium", "high", "critical") },
      { name: "description", label: "Description", kind: "multiline" },
    ],
  },
  // ── Education ──────────────────────────────────────────────────────────
  "education.admission": {
    title: "New admission", submitLabel: "Create admission", path: "/api/education/admissions", queryKey: "education", permission: "education.admissions.create",
    fields: [
      { name: "applicantName", label: "Applicant", kind: "text", required: true },
      { name: "program", label: "Programme", kind: "text", required: true },
      { name: "intakeTerm", label: "Intake term", kind: "text" },
      { name: "guardianName", label: "Guardian", kind: "text" },
      { name: "phone", label: "Phone", kind: "text" },
      { name: "email", label: "Email", kind: "text" },
      { name: "notes", label: "Notes", kind: "multiline" },
    ],
  },
  "education.student": {
    title: "New student", submitLabel: "Add student", path: "/api/education/students", queryKey: "education", permission: "education.students.create",
    fields: [
      { name: "fullName", label: "Full name", kind: "text", required: true },
      { name: "gender", label: "Gender", kind: "choice", default: "male", options: opts("male", "female") },
      { name: "program", label: "Programme", kind: "text" },
      { name: "guardianName", label: "Guardian", kind: "text" },
      { name: "phone", label: "Phone", kind: "text" },
      { name: "email", label: "Email", kind: "text" },
      { name: "notes", label: "Notes", kind: "multiline" },
    ],
  },
  "education.enrollment": {
    title: "New enrollment", submitLabel: "Enroll", path: "/api/education/enrollments", queryKey: "education", permission: "education.enrollments.create",
    fields: [
      { name: "studentId", label: "Student", kind: "lookup", required: true, labelAs: "studentName", lookup: { path: "/api/education/students", label: "fullName", sub: "studentNumber" } },
      { name: "course", label: "Course", kind: "text", required: true },
      { name: "term", label: "Term", kind: "text" },
      { name: "feeTotal", label: "Total fee", kind: "number", blank: "zero" },
      { name: "notes", label: "Notes", kind: "multiline" },
    ],
  },
  // ── Healthcare ─────────────────────────────────────────────────────────
  "healthcare.patient": {
    title: "New patient", submitLabel: "Add patient", path: "/api/healthcare/patients", queryKey: "healthcare", permission: "healthcare.patients.create",
    fields: [
      { name: "fullName", label: "Full name", kind: "text", required: true },
      { name: "gender", label: "Gender", kind: "choice", default: "male", options: opts("male", "female") },
      { name: "dateOfBirth", label: "Date of birth", kind: "date" },
      { name: "phone", label: "Phone", kind: "text" },
      { name: "email", label: "Email", kind: "text" },
      { name: "bloodGroup", label: "Blood group", kind: "text" },
      { name: "assignedDoctor", label: "Doctor", kind: "text" },
      { name: "notes", label: "Notes", kind: "multiline" },
    ],
  },
  "healthcare.appointment": {
    title: "New appointment", submitLabel: "Book appointment", path: "/api/healthcare/appointments", queryKey: "healthcare", permission: "healthcare.appointments.create",
    fields: [
      { name: "patientId", label: "Patient", kind: "lookup", required: true, labelAs: "patientName", lookup: { path: "/api/healthcare/patients", label: "fullName", sub: "patientNumber" } },
      { name: "doctor", label: "Doctor", kind: "text", required: true },
      { name: "department", label: "Department", kind: "text" },
      { name: "scheduledAt", label: "When", kind: "datetime", required: true },
      { name: "reason", label: "Reason", kind: "multiline" },
    ],
  },
  "healthcare.plan": {
    title: "New treatment plan", submitLabel: "Create plan", path: "/api/healthcare/treatment-plans", queryKey: "healthcare", permission: "healthcare.treatment-plans.create",
    fields: [
      { name: "patientId", label: "Patient", kind: "lookup", required: true, labelAs: "patientName", lookup: { path: "/api/healthcare/patients", label: "fullName", sub: "patientNumber" } },
      { name: "diagnosis", label: "Diagnosis", kind: "text", required: true },
      { name: "plan", label: "Plan", kind: "multiline", required: true },
      { name: "doctor", label: "Doctor", kind: "text", required: true },
      { name: "startDate", label: "Start", kind: "date", required: true, dateOffsetDays: 0 },
      { name: "followUpDate", label: "Follow-up", kind: "date" },
      { name: "notes", label: "Notes", kind: "multiline" },
    ],
  },
  // ── Support ────────────────────────────────────────────────────────────
  "support.ticket": {
    title: "New support request", submitLabel: "Send request", path: "/api/support/tickets", queryKey: "support", permission: "",
    fields: [
      { name: "subject", label: "Subject", kind: "text", required: true },
      { name: "category", label: "Category", kind: "choice", default: "general", options: [
        { value: "technical", label: "Technical" }, { value: "billing", label: "Billing" }, { value: "feature_request", label: "Feature request" },
        { value: "onboarding", label: "Onboarding" }, { value: "account_security", label: "Account" }, { value: "general", label: "General" },
      ] },
      { name: "priority", label: "Priority", kind: "choice", default: "medium", options: opts("low", "medium", "high", "urgent") },
      { name: "message", label: "Describe the problem", kind: "multiline", required: true },
    ],
  },
  // ── Insurance ──────────────────────────────────────────────────────────
  "insurance.policy": {
    title: "New policy", submitLabel: "Create policy", path: "/api/insurance/policies", queryKey: "insurance", permission: "insurance.policies.create",
    fields: [
      { name: "holderName", label: "Policy holder", kind: "text", required: true },
      { name: "productType", label: "Product", kind: "choice", default: "motor", options: opts("life", "health", "motor", "property", "travel") },
      { name: "premium", label: "Premium", kind: "number", required: true },
      { name: "sumInsured", label: "Sum insured", kind: "number", required: true },
      { name: "startDate", label: "Start", kind: "date", required: true, dateOffsetDays: 0 },
      { name: "endDate", label: "End", kind: "date", required: true, dateOffsetDays: 365 },
      { name: "agent", label: "Agent", kind: "text" },
      { name: "notes", label: "Notes", kind: "multiline" },
    ],
  },
  "insurance.claim": {
    title: "New claim", submitLabel: "File claim", path: "/api/insurance/claims", queryKey: "insurance", permission: "insurance.claims.create",
    fields: [
      { name: "policyId", label: "Policy", kind: "lookup", required: true, lookup: { path: "/api/insurance/policies", label: "holderName", sub: "policyNumber" } },
      { name: "claimDate", label: "Claim date", kind: "date", required: true, dateOffsetDays: 0 },
      { name: "claimAmount", label: "Claim amount", kind: "number", required: true },
      { name: "reason", label: "Reason", kind: "multiline" },
      { name: "notes", label: "Notes", kind: "multiline" },
    ],
  },
};

/**
 * One-tap forward step for a row, mirroring the web tables. `body` builds the request body (default none).
 * `permission` is the edit key for that area.
 */
export interface NextStep {
  from: string[];
  label: string;
  path: (id: string) => string;
  method: "PATCH" | "POST";
  /** A fixed body, or one built from the row (e.g. today's date, the balance still owed). */
  body?: Record<string, unknown> | ((record: Record<string, unknown>) => Record<string, unknown>);
  /** Empty = no permission key gates this action (module access is the only gate). */
  permission: string;
  queryKey: string;
  /** Ask first (a native alert) -- for steps that move money or cannot be undone. */
  confirm?: string;
}

const status = (to: string) => ({ status: to });

export const NEXT_STEPS: Record<string, NextStep[]> = {
  "b2b.proposal": [
    { from: ["draft"], label: "Mark sent", path: (id) => `/api/b2b/proposals/${id}/status`, method: "PATCH", body: status("sent"), permission: "b2b.proposals.edit", queryKey: "b2b" },
    { from: ["sent"], label: "Mark accepted", path: (id) => `/api/b2b/proposals/${id}/status`, method: "PATCH", body: status("accepted"), permission: "b2b.proposals.edit", queryKey: "b2b" },
  ],
  "b2b.contract": [
    { from: ["active"], label: "Renew", path: (id) => `/api/b2b/contracts/${id}/status`, method: "PATCH", body: status("renewed"), permission: "b2b.contracts.edit", queryKey: "b2b" },
  ],
  "b2b.ticket": [
    { from: ["open"], label: "Start work", path: (id) => `/api/b2b/tickets/${id}/status`, method: "PATCH", body: status("in_progress"), permission: "b2b.tickets.edit", queryKey: "b2b" },
    { from: ["in_progress"], label: "Resolve", path: (id) => `/api/b2b/tickets/${id}/resolve`, method: "POST", body: { resolution: null }, permission: "b2b.tickets.edit", queryKey: "b2b" },
  ],
  "education.admission": [
    { from: ["inquiry"], label: "Mark applied", path: (id) => `/api/education/admissions/${id}/status`, method: "PATCH", body: status("applied"), permission: "education.admissions.edit", queryKey: "education" },
  ],
  "healthcare.appointment": [
    { from: ["scheduled"], label: "Mark completed", path: (id) => `/api/healthcare/appointments/${id}/status`, method: "PATCH", body: status("completed"), permission: "healthcare.appointments.edit", queryKey: "healthcare" },
  ],
  "healthcare.plan": [
    { from: ["active"], label: "Mark completed", path: (id) => `/api/healthcare/treatment-plans/${id}/status`, method: "PATCH", body: status("completed"), permission: "healthcare.treatment-plans.edit", queryKey: "healthcare" },
  ],
  "insurance.policy": [
    { from: ["proposal"], label: "Issue policy", path: (id) => `/api/insurance/policies/${id}/status`, method: "PATCH", body: status("issued"), permission: "insurance.policies.edit", queryKey: "insurance" },
  ],
  "insurance.claim": [
    { from: ["approved"], label: "Mark paid", path: (id) => `/api/insurance/claims/${id}/status`, method: "PATCH", body: status("paid"), permission: "insurance.claims.edit", queryKey: "insurance" },
  ],
};
