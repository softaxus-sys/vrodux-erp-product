import * as React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, Plus, Minus, ShoppingCart, CheckCircle2, UtensilsCrossed } from "lucide-react";
import { publicOrderApi, getGuestDeviceToken } from "@/lib/restaurant/public-order.api";
import type { PublicMenu, PublicOrderLine } from "@/lib/restaurant/restaurant.api";

interface CartLine { menuItemId: string; name: string; price: number; quantity: number }

export default function GuestOrderPage() {
  const { qrCode = "" } = useParams<{ qrCode: string }>();
  const [searchParams] = useSearchParams();
  const isKiosk = searchParams.get("kiosk") === "1";

  const [menu, setMenu] = React.useState<PublicMenu | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [notes, setNotes] = React.useState("");
  const [placing, setPlacing] = React.useState(false);
  const [placedOrderNumber, setPlacedOrderNumber] = React.useState<string | null>(null);
  const [placeError, setPlaceError] = React.useState<string | null>(null);

  React.useEffect(() => {
    publicOrderApi.getMenu(qrCode)
      .then(setMenu)
      .catch(() => setLoadError("This QR code isn't valid, or the menu is unavailable right now."));
  }, [qrCode]);

  const addItem = (item: { id: string; name: string; price: number }) => setCart(prev => {
    const ex = prev.find(l => l.menuItemId === item.id);
    if (ex) return prev.map(l => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l);
    return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
  });
  const setQty = (menuItemId: string, delta: number) => setCart(prev =>
    prev.map(l => l.menuItemId === menuItemId ? { ...l, quantity: l.quantity + delta } : l).filter(l => l.quantity > 0));

  const total = cart.reduce((s, l) => s + l.price * l.quantity, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true); setPlaceError(null);
    try {
      const items: PublicOrderLine[] = cart.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity }));
      const result = await publicOrderApi.placeOrder({
        qrCode, channel: isKiosk ? "kiosk" : "qr_table", notes: notes.trim() || null,
        guestDeviceToken: getGuestDeviceToken(), items,
      });
      setPlacedOrderNumber(result.orderNumber);
      setCart([]);
    } catch (e: any) {
      setPlaceError(e?.message ?? "Couldn't place the order. Please ask a staff member for help.");
    } finally {
      setPlacing(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="text-center text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (placedOrderNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-3 max-w-sm">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Order Sent!</h1>
          <p className="text-sm text-muted-foreground">
            Order <span className="font-mono font-semibold">{placedOrderNumber}</span> has been sent to the kitchen.
            {!isKiosk && " A server will bring it to your table."}
          </p>
          <button onClick={() => setPlacedOrderNumber(null)} className="text-sm text-primary hover:underline">
            Order something else
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5" />
          {isKiosk ? "Self-Order Kiosk" : `Table ${menu.tableNumber}`}
        </h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {menu.categories.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">No items available for ordering right now.</p>
        )}
        {menu.categories.map(cat => (
          <div key={cat.id}>
            <h2 className="text-sm font-semibold text-foreground mb-2">{cat.name}</h2>
            <div className="space-y-2">
              {cat.items.map(item => {
                const line = cart.find(l => l.menuItemId === item.id);
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                      <p className="text-sm font-semibold text-primary mt-0.5">{item.price.toFixed(2)}</p>
                    </div>
                    {line ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setQty(item.id, -1)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="text-sm font-bold w-5 text-center">{line.quantity}</span>
                        <button onClick={() => setQty(item.id, 1)} className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => addItem(item)} className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {cart.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground">Notes for the kitchen (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-card resize-none" />
          </div>
        )}
        {placeError && <p className="text-xs text-destructive">{placeError}</p>}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-card border-t border-border p-4">
          <div className="max-w-lg mx-auto">
            <button onClick={handlePlaceOrder} disabled={placing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-60">
              {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              Place Order — {total.toFixed(2)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
