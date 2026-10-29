import * as React from "react";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useStoreCustomers, useStoreSettings } from "@/hooks/ecommerce/use-store";
import { PageHeader, Pager, SearchBox, TH, TableState, useDebounced } from "../../shared/ui";
import { SetupStore } from "./store-settings-view";

const PAGE = 25;

export function StoreCustomersView() {
  const store = useStoreSettings();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const q = useDebounced(search);
  React.useEffect(() => setPage(1), [q]);
  const customers = useStoreCustomers({ search: q || undefined, page, pageSize: PAGE });

  if (store.isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!store.data) return <SetupStore />;
  const rows = customers.data?.items ?? [];
  const cur = store.data.currencyCode;

  return (
    <div className="space-y-6">
      <PageHeader title="Store customers" description="People who created an account in your online store. Guests who checked out without one are on their orders." />
      <SearchBox value={search} onChange={setSearch} placeholder="Search name, email or phone" className="w-full sm:w-72" />
      <Card className="overflow-hidden">
        <TableState loading={customers.isLoading} error={customers.error as Error | null} empty={rows.length === 0} emptyText="No customer accounts yet." icon={Users} />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className={TH}>Customer</th><th className={TH}>Phone</th><th className={TH}>Orders</th><th className={TH}>Spent</th><th className={TH}>Joined</th><th className={TH}>Last sign-in</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3"><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground" dir="ltr">{c.email}</p></td>
                    <td className="px-4 py-3 text-muted-foreground" dir="ltr">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{c.orders}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCurrency(c.totalSpent, cur)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.lastSignInAt ? formatDate(c.lastSignInAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={PAGE} total={customers.data?.totalCount ?? 0} onPage={setPage} />
      </Card>
    </div>
  );
}
