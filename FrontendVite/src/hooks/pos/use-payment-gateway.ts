import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { paymentGatewayApi, type UpsertPaymentGatewayConfigRequest } from "@/lib/pos/payment-gateway.api";

const QK = "pos-payment-gateway";

export const usePaymentGatewayCatalog = () =>
  useQuery({ queryKey: [QK, "catalog"], queryFn: paymentGatewayApi.getCatalog });

export const usePaymentGatewayConfig = () =>
  useQuery({ queryKey: [QK, "config"], queryFn: paymentGatewayApi.getConfig });

export function useUpsertPaymentGatewayConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: UpsertPaymentGatewayConfigRequest) => paymentGatewayApi.upsertConfig(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "config"] });
      toast.success("Payment gateway settings saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
