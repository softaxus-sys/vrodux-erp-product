import { StorefrontByPath } from "@/modules/storefront/storefront-app";

/** /shop/:slug/… — a store served from the ERP's own address. Public: no sign-in, no ERP layout. */
export default function Page() { return <StorefrontByPath />; }
