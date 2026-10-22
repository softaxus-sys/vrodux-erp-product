# Vrodux website: module pages — publishing guide

One file per module in this folder. Each has: headline, overview, who it's for, features, connections to other modules, access control, and **"Do not claim yet"** (things not built — keep them off the website).

## Rules for accuracy
1. Publish only what is under **Features**. Anything under **Do not claim yet** is not built.
2. Many modules were built and verified by build/scripted API checks, but **not all were clicked through in a browser on production**. Before launch, do a visual run of each module and update "Verification status" in the file.
3. Pricing: the only pricing dimension is **users** (tiers of 3 / 10 / 50 users; Enterprise = contact sales). **Every module is available on every tier.** Free trial = **14 days with unlimited users**. Confirm current dollar prices against the billing page before publishing; do not copy old numbers from older docs (earlier plans split modules by tier — that is no longer true).
4. Do not promise: Arabic-language customer-facing pages (portals/emails are English only in several modules), SMS/WhatsApp sending, FTA direct VAT submission, bank-statement import, or any item listed under "Do not claim yet".
5. Compliance wording: Vrodux **prepares** UAE VAT returns, WPS salary files and e-invoicing groundwork; it does **not** submit to the FTA or banks automatically. Say "prepare / export / reconcile", never "files with the FTA".
6. Everything is multi-tenant: each customer's data is isolated. Roles and permissions are customisable per customer.

## Index
| File | Module |
|---|---|
| 01-crm.md | CRM (leads, pipeline, accounts, reports, integrations) |
| 02-sales.md | Sales (quotations, orders, delivery, returns) |
| 03-purchase.md | Purchase (vendors, POs, GRN, returns, approvals) |
| 04-inventory.md | Inventory |
| 05-finance.md | Finance & Accounting |
| 06-hr-payroll.md | HR, Attendance, Leave, Payroll, WPS |
| 07-pos-retail.md | Retail POS (incl. offline mode, credit) |
| 08-restaurant.md | Restaurant |
| 09-hotel-pms.md | Hospitality — Hotel PMS |
| 10-tourism.md | Hospitality — Tourism |
| 11-real-estate.md | Real Estate |
| 12-project-management.md | Project Management |
| 13-visa-services.md | Visa Services |
| 14-manufacturing.md | Manufacturing |
| 15-library.md | Library Management |
| 16-import-export.md | Import / Export (Trade) |
| 17-lead-generation.md | Lead Generation |
| 18-industry-verticals.md | B2B, Education, Healthcare, Insurance |
| 19-ai-assistant.md | AI Assistant |
| 20-platform.md | Platform: security, roles, billing, reports hub, file manager, notifications, mobile, desktop |
