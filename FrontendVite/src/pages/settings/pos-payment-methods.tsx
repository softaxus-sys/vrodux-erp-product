import { PaymentMethodsSettings } from "@/modules/settings/pos/components/payment-methods-settings";
import { OfflineModeSettings } from "@/modules/settings/pos/components/offline-mode-settings";

export default function PosPaymentMethodsPage() {
  return (
    <>
      <OfflineModeSettings />
      <PaymentMethodsSettings />
    </>
  );
}
