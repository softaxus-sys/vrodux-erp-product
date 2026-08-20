# Multi-Language Support Implementation Status

## Completed Modules

### 1. Purchase Module ✅
**Status:** Partially Complete (Main views wired, translation keys created)

#### Completed Files:
- `FrontendVite/src/i18n/index.ts` - Namespace registered
- `FrontendVite/src/i18n/locales/en/purchase.json` - English keys added
- `FrontendVite/src/i18n/locales/ar/purchase.json` - Arabic keys added
- `FrontendVite/src/modules/purchase/orders/components/purchase-orders-view.tsx` - ✅ Wired
- `FrontendVite/src/modules/purchase/orders/components/purchase-order-drawer.tsx` - ✅ Wired
- `FrontendVite/src/modules/purchase/orders/components/add-purchase-order-form.tsx` - ✅ Wired
- `FrontendVite/src/modules/purchase/grn/components/grn-view.tsx` - Partially wired
- `FrontendVite/src/modules/purchase/returns/components/purchase-returns-view.tsx` - Partially wired

#### Remaining Purchase Files (Need Wiring):
```
- FrontendVite/src/modules/purchase/grn/components/create-grn-form.tsx
- FrontendVite/src/modules/purchase/returns/components/create-purchase-return-form.tsx
- FrontendVite/src/modules/purchase/bills/components/purchase-bills-view.tsx
- FrontendVite/src/modules/purchase/bills/components/create-purchase-bill-form.tsx
- FrontendVite/src/modules/purchase/vendors/components/vendors-view.tsx
- FrontendVite/src/modules/purchase/vendors/components/add-vendor-form.tsx
- FrontendVite/src/modules/purchase/vendors/components/vendor-drawer.tsx
- FrontendVite/src/modules/purchase/approvals/components/approvals-view.tsx
- FrontendVite/src/modules/purchase/approvals/components/approval-drawer.tsx
```

### 2. Visa Services Module 📋
**Status:** Translation Keys Created (Files need wiring)

#### Completed:
- `FrontendVite/src/i18n/locales/en/visa.json` - ✅ Created
- `FrontendVite/src/i18n/locales/ar/visa.json` - ✅ Created
- Namespace registered in i18n/index.ts - ✅

#### Files Needing Wiring:
```
- FrontendVite/src/modules/visa/cases/components/visa-cases-view.tsx
- FrontendVite/src/modules/visa/renewals/components/visa-renewals-view.tsx
- FrontendVite/src/modules/visa/types/components/visa-types-view.tsx
- FrontendVite/src/modules/visa/channels/components/visa-channels-view.tsx
- All forms and drawers under visa module
```

### 3. Restaurant POS Module 📋
**Status:** Translation Keys Created (Files need wiring)

#### Completed:
- `FrontendVite/src/i18n/locales/en/restaurant.json` - ✅ Created
- `FrontendVite/src/i18n/locales/ar/restaurant.json` - ✅ Created
- Namespace registered in i18n/index.ts - ✅

#### Files Needing Wiring:
```
- FrontendVite/src/modules/restaurant/orders/components/restaurant-pos-view.tsx
- FrontendVite/src/modules/restaurant/menu/components/menu-view.tsx
- FrontendVite/src/modules/restaurant/kitchen/components/kitchen-display-view.tsx
- FrontendVite/src/modules/restaurant/reservations/components/reservations-view.tsx
- All forms and drawers under restaurant module
```

## Standard Wiring Pattern

### For View Files (e.g., module-view.tsx):
```typescript
// 1. Add import
import { useTranslation } from "react-i18next";

// 2. In component, add hook
const { t } = useTranslation("modulename");

// 3. Replace hardcoded strings with t() calls:
// Before:
<h1 className="text-2xl font-bold">Purchase Orders</h1>
<p className="text-sm text-muted-foreground mt-0.5">Manage supplier orders</p>
<Input placeholder="Search PO or vendor…" />

// After:
<h1 className="text-2xl font-bold">{t("orders.title")}</h1>
<p className="text-sm text-muted-foreground mt-0.5">{t("orders.description")}</p>
<Input placeholder={t("orders.search")} />
```

### For Status Configs (move inside component):
```typescript
// Move STATUS_CONFIG inside component to access t()
export function ModuleView() {
  const { t } = useTranslation("modulename");
  
  const STATUS_CONFIG = {
    draft: { label: t("status.draft"), ... },
    sent: { label: t("status.sent"), ... },
  };
}
```

### For Forms:
- Add `useTranslation` hook
- Replace all labels, placeholders, button text with `t()` calls
- Move any option arrays that have labels inside component to access `t()`

## Additional Modules (Not yet registered)

The following modules may need i18n support but JSON files haven't been created yet:
- B2B Module
- Education Module
- Healthcare Module
- Insurance Module
- Real Estate Module
- Construction Module
- Hospitality Module
- Recipe Module

## Common Translation Keys Used Across Modules

These keys should be added to `common.json` if not already present:
```json
{
  "loading": "Loading…",
  "search": "Search…",
  "noResults": "No results found",
  "add": "Add",
  "new": "New",
  "edit": "Edit",
  "delete": "Delete",
  "cancel": "Cancel",
  "confirm": "Confirm",
  "save": "Save",
  "saving": "Saving…",
  "close": "Close",
  "prev": "Prev",
  "next": "Next",
  "select": "Select…",
  "placeholder": {
    "notes": "Add notes…",
    "search": "Search…"
  }
}
```

## Implementation Priority

1. **Complete Purchase Module** (most used operational module)
2. **Wire Visa Services** (high revenue impact)
3. **Wire Restaurant POS** (large codebase of views)
4. **Wire Industry Verticals** (B2B, Education, Healthcare, Insurance)
5. **Wire remaining operational modules** (Real Estate, Construction)

## Testing Checklist

After wiring each module:
- [ ] All hardcoded UI strings replaced with `t()` calls
- [ ] No TypeScript errors from missing translation keys
- [ ] Language toggle switches text in the module
- [ ] RTL layout works correctly in Arabic
- [ ] All status badges, labels, and button text are translated

## Maintenance Notes

- Keep translation keys organized by feature/screen
- Use nested keys for related concepts (e.g., `orders.status.draft`, `orders.table.poNumber`)
- Ensure parity between English and Arabic JSON files
- Test all dynamic content that uses `t()` with interpolation (e.g., `t("key", { count })`)
