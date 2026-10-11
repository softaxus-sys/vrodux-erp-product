import { apiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/customers`;

/** One credit sale (or restaurant charge) and how much of it is still owed. */
export interface CreditItemDto {
  id: string; date: string; dueOn: string; reference: string; saleId: string | null;
  amount: number; outstanding: number; daysOverdue: number;
}

export type CreditEntryKind = "charge" | "payment" | "returned";

export interface CreditEntryDto {
  id: string; at: string; kind: CreditEntryKind; amount: number; reference: string;
  method: string | null; balanceAfter: number;
}

export interface CreditAgeingDto {
  current: number; days1To30: number; days31To60: number; days61To90: number; over90: number;
  total: number; overdue: number;
}

export interface CustomerCreditDto {
  customerId: string; name: string; phone: string | null; email: string | null; address: string | null;
  creditLimit: number; creditBalance: number; availableCredit: number; termsDays: number;
  onHold: boolean; holdReason: string | null;
  overdue: number; oldestOverdueDays: number; nextDueOn: string | null; nextDueAmount: number;
  lastPaymentOn: string | null; lastPaymentAmount: number; totalCharged: number; totalPaid: number;
  ageing: CreditAgeingDto; openItems: CreditItemDto[]; entries: CreditEntryDto[];
}

export interface CreditCustomerRowDto {
  customerId: string; name: string; phone: string | null;
  creditLimit: number; creditBalance: number; availableCredit: number; termsDays: number;
  onHold: boolean; overdue: number; oldestOverdueDays: number; nextDueOn: string | null; lastPaymentOn: string | null;
}

export interface CreditOverviewDto {
  totalOutstanding: number; totalOverdue: number; totalLimit: number; collectedThisMonth: number;
  customersWithBalance: number; customersOverdue: number; nearLimit: number; onHold: number; dueThisWeek: number;
  ageing: CreditAgeingDto; customers: CreditCustomerRowDto[]; truncated: boolean;
}

export interface CreditReminderSettingsDto {
  enabled: boolean; daysBeforeDue: number; overdueAfterDays: number; repeatEveryDays: number; maxOverdueReminders: number;
  senderName: string; ccEmail: string | null; timeZoneId: string; mailConfigured: boolean;
}
export type CreditReminderSettingsInput = Omit<CreditReminderSettingsDto, "mailConfigured">;
export interface CreditReminderLogDto {
  id: string; customerId: string; customerName: string; email: string; kind: string; amount: number; status: string; error: string | null; at: string;
}
export interface CreditReminderRunDto {
  dueSoon: number; overdue: number; failed: number; noEmail: number; dryRun: boolean;
  recipients: { customerId: string; name: string; email: string; kind: string; amount: number }[];
}

export const creditApi = {
  getReminderSettings: () => apiClient.get<CreditReminderSettingsDto>(`${BASE}/credit/reminders/settings`),
  saveReminderSettings: (s: CreditReminderSettingsInput) => apiClient.put<CreditReminderSettingsDto>(`${BASE}/credit/reminders/settings`, s),
  runReminders: (dryRun: boolean) => apiClient.post<CreditReminderRunDto>(`${BASE}/credit/reminders/run?dryRun=${dryRun}`),
  getReminderLog: (customerId?: string) => apiClient.get<CreditReminderLogDto[]>(`${BASE}/credit/reminders/log${customerId ? `?customerId=${customerId}` : ""}`),
  remindCustomer: (id: string) => apiClient.post<CreditReminderLogDto>(`${BASE}/${id}/credit/remind`),
  getCustomer: (id: string) => apiClient.get<CustomerCreditDto>(`${BASE}/${id}/credit`),
  getOverview: () => apiClient.get<CreditOverviewDto>(`${BASE}/credit/overview`),
  setTerms: (id: string, days: number) => apiClient.put<unknown>(`${BASE}/${id}/credit-terms`, { days }),
  setHold: (id: string, hold: boolean, reason: string | null) => apiClient.put<unknown>(`${BASE}/${id}/credit-hold`, { hold, reason }),
};
