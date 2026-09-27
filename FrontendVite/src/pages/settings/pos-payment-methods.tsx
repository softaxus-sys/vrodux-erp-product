import { PaymentMethodsSettings } from "@/modules/settings/pos/components/payment-methods-settings";
import { OfflineModeSettings } from "@/modules/settings/pos/components/offline-mode-settings";
import { OutOfStockSettings } from "@/modules/settings/pos/components/out-of-stock-settings";

export default function PosPaymentMethodsPage() {
  return (
    <>
      <OfflineModeSettings />
      <OutOfStockSettings />
      <PaymentMethodsSettings />
    </>
  );
}
