import { Can } from "@/components/auth/can";
import { CreditControlView } from "@/modules/pos/credit/components/credit-control-view";

export default function Page() {
  return (
    <Can permission="pos.customers.view"
      fallback={<p className="p-8 text-center text-sm text-muted-foreground">You don't have access to customer credit.</p>}>
      <CreditControlView />
    </Can>
  );
}
