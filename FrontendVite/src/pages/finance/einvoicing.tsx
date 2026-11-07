import { Can } from "@/components/auth/can";
import { EInvoicingView } from "@/modules/finance/einvoicing/components/einvoicing-view";

export default function Page() {
  return (
    <Can
      permission="finance.einvoicing.view"
      fallback={<div className="p-10 text-center text-sm text-muted-foreground">You do not have access to e-invoicing.</div>}
    >
      <EInvoicingView />
    </Can>
  );
}
