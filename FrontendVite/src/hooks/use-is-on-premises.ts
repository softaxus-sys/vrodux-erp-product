import { useQuery } from "@tanstack/react-query";
import { licenseApi } from "@/lib/identity/license.api";

/**
 * True only on an on-premises installation. Unknown (still loading, or the call failed) counts as
 * false, so a cloud workspace never flashes on-prem-only pages.
 */
export function useIsOnPremises(): boolean {
  const { data } = useQuery({
    queryKey: ["license-status"],
    queryFn: licenseApi.status,
    staleTime: Infinity,
    retry: false,
  });
  return data?.isOnPremises === true;
}
