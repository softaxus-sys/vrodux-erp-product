/** Shared React Query key prefix for every CRM query in the app -- keeps invalidations
 *  (e.g. useConvertLead touching both a lead and the deals list) pointed at the same root. */
export const QK = "crm" as const;
