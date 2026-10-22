import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { einvoiceApi } from "@/lib/finance/einvoice.api";

const key = (invoiceId: string) => ["finance", "einvoice", invoiceId] as const;

/** Builds and checks the invoice's PINT AE XML on the server. Only runs while the panel is open. */
export function useEInvoiceStatus(invoiceId: string, enabled: boolean) {
  return useQuery({
    queryKey: key(invoiceId),
    queryFn:  () => einvoiceApi.getStatus(invoiceId),
    enabled:  enabled && !!invoiceId,
    staleTime: 0,
  });
}

export function useSubmitEInvoice(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => einvoiceApi.submit(invoiceId),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: key(invoiceId) });
      // The outcome is reported as it is — "sent" only when the provider actually took it.
      if (s.status === "accepted") toast.success("E-invoice accepted by the provider.");
      else if (s.status === "not_configured") toast.info("No e-invoicing provider is connected, so nothing was sent.");
      else if (s.status === "rejected") toast.error(`The provider rejected the e-invoice. ${s.message ?? ""}`.trim());
      else toast.error(`Sending failed. ${s.message ?? ""}`.trim());
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
