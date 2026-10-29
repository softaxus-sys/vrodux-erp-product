import * as React from "react";
import { Route, Routes, useParams } from "react-router-dom";
import { StoreProvider } from "./store-context";
import { StoreShell } from "./layout";
import { CartPage, CmsPage, NotFound, ProductPage, ProductsPage } from "./catalogue-pages";
import { CheckoutPage, OrderPage } from "./checkout-pages";
import { AccountPage, ResetPasswordPage } from "./account-pages";

/** The routes of a store, relative to wherever it is mounted. */
export function StoreRoutes() {
  return (
    <StoreShell>
      <Routes>
        <Route index element={<CmsPage pageSlug="home" />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:productSlug" element={<ProductPage />} />
        <Route path="collections/:collectionSlug" element={<ProductsPage collectionMode />} />
        <Route path="pages/:pageSlug" element={<CmsPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="order/:number" element={<OrderPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="account/reset" element={<ResetPasswordPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </StoreShell>
  );
}

/** Served from the ERP's own address: /shop/{slug}/… */
export function StorefrontByPath() {
  const { slug = "" } = useParams();
  return (
    <StoreProvider slug={slug} basePath={`/shop/${slug}`}>
      <StoreRoutes />
    </StoreProvider>
  );
}

/** Served from the store's own address (a custom domain or a sub-domain): the store is the whole site. */
export function StorefrontByHost({ slug }: { slug: string }) {
  return (
    <StoreProvider slug={slug} basePath="">
      <StoreRoutes />
    </StoreProvider>
  );
}
