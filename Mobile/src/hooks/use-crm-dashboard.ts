import { useQuery } from "@tanstack/react-query";
import { crmApi } from "@/lib/crm.api";

export function useCrmDashboard(enabled = true) {
  return useQuery({
    queryKey: ["crm", "dashboard"],
    queryFn: crmApi.getDashboard,
    enabled,
  });
}
