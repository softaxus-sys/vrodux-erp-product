import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { shopApi, type Quote } from "@/lib/storefront/shop.api";
import { useStore } from "./store-context";

/**
 * The cart, priced by the server. The browser only reports "this product, this many" — every price, stock level, discount and
 * delivery charge comes back from the store, so nothing a shopper's device holds can lower a price.
 */
export function useQuote(opts: { country?: string | null; zoneId?: string | null; enabled?: boolean } = {}) {
  const { slug, cart, discountCode } = useStore();
  const items = cart.map(c => ({ productId: c.productId, quantity: c.quantity }));
  const code = discountCode.trim() || null;
  return useQuery<Quote>({
    queryKey: ["shop", slug, "quote", items, code, opts.country ?? null, opts.zoneId ?? null],
    queryFn: () => shopApi.quote(slug, items, code, opts.country ?? null, opts.zoneId ?? null),
    enabled: (opts.enabled ?? true) && items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
}
