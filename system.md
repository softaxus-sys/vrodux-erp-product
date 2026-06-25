# Vrodux ERP — System Overview

> **Purpose of this document:** A single, plain-English reference describing what Vrodux ERP *is*, who it is
> *for*, what every module *does*, and what makes it different from other ERP platforms — written for product
> branding, marketing, sales enablement, and AI agents (chatbots, copilots, support assistants) that need to
> understand the whole system without reading source code.

---

## 1. What Is Vrodux ERP?

**Vrodux ERP** (codebase: `softaxis-erp`, by **Softaxis**) is a **modular, multi-tenant, cloud-based Enterprise
Resource Planning (ERP) platform** built for small, medium, and growing businesses across **retail, food &
beverage, professional services, and vertical industries** (real estate, construction, hospitality, healthcare,
education, insurance, B2B services).

It is delivered as a **single web application** (one login, one dashboard, one design system) that gives a
business everything it needs to run day-to-day operations — **sales, inventory, finance, HR/payroll, customer
relationships, point-of-sale, and industry-specific operations** — without stitching together multiple
disconnected tools (e.g., a separate POS, a separate accounting package, a separate HR system, a separate CRM).

### Elevator Pitch
> "One login. Every department. Real-time numbers. Vrodux ERP replaces the spreadsheet-and-app sprawl that
> growing businesses drown in — Sales, Inventory, Finance, HR, CRM, and your industry's specific workflows, all
> in one connected system, accessible from anywhere."

---

## 2. Who Is It For? (Target Clients)

Vrodux ERP is designed as a **"choose your own adventure" platform** — during onboarding (signup), a business
picks its **industry** and the system **auto-selects the right modules** for them. This makes it suitable for:

| Client Type | Example Businesses | Modules They'd Use |
|---|---|---|
| **Retail / Commerce** | Apparel, electronics, supermarkets, hypermarkets, pharmacies, mobile shops, optical stores, hardware/DIY, pet stores, toy stores | POS, Inventory, Sales, Purchase, Finance |
| **Food & Beverage / Hospitality** | Restaurants, cafés, cloud kitchens, hotels, resorts | POS (Restaurant), Recipe/Kitchen, Inventory, Hospitality (rooms/bookings/housekeeping), HR, Finance |
| **Professional / B2B Services** | Agencies, consultancies, salons & spas | CRM, Sales, Finance, HR, B2B Proposals/Contracts |
| **Construction & Contracting** | Building contractors, fit-out companies, project-based firms | Construction (projects, BOQ, contractors, sites), Purchase, HR, Finance |
| **Real Estate** | Brokerages, property managers, landlords | Real Estate (properties, units, tenants, contracts, brokers), CRM, Finance |
| **Healthcare** | Clinics, small healthcare providers | Healthcare (patients, appointments, billing) |
| **Education** | Schools, training centers, academies | Education (students, courses, fees, admissions) |
| **Insurance** | Brokers/agencies | Insurance (policies & claims) |
| **Multi-branch / Multi-company groups** | Any of the above operating multiple outlets/branches under one account | Branches + Super Admin (tenant management) |

**Target market context:** Built with UAE/GCC compliance in mind (AED currency defaults, **VAT/Tax module**,
**WPS — UAE Wage Protection System** payroll file generation, Arabic RTL labels throughout the UI, multi-currency
and multi-timezone support for international operations).

### Multi-Tenancy
The platform is **multi-tenant** — a **Super Admin** layer can create and manage multiple tenant organizations
("Create Tenant" / tenant detail pages), each with its own module selection, branches, users, and data —
making Vrodux suitable both for **direct customers** (a single company running the ERP) and for **Softaxis as a
SaaS provider** managing many customer accounts from one control panel.

---

## 3. The Onboarding Experience (Why It Matters for Branding)

New customers go through a **4-step guided signup**:

1. **Create Account** — personal login credentials for the workspace owner.
2. **Set Up Organization** — country, currency, language, timezone, fiscal year, and **industry**. Choosing an
   industry (e.g., "Construction", "Hospitality & Tourism", "Retail") **automatically pre-selects the relevant
   modules** — no technical configuration required.
3. **Pick Your Modules** — a visual module marketplace where the business can fine-tune their selection.
   Modules have smart **dependencies** (e.g., POS requires Inventory) and **recommendations** (e.g., Inventory
   recommends Purchase + Sales).
4. **Business Type** — for commerce-oriented modules (POS, Inventory, Sales, Purchase), the business picks a
   specific vertical from **23 business types** (Apparel, Supermarket, Pharmacy, Restaurant & Café, Electronics,
   Salon/Spa, Vehicle & Parts, Mobile & Telecom, Optical, Hardware/DIY, Hypermarket, etc.) — this lets the
   system **pre-configure sensible defaults** for that kind of business.

This "pick what you need" model is core to the brand promise: **pay for and see only what's relevant to your
business**, while still being one unified, connected platform underneath.

---

## 4. Complete Module Catalogue

### 4.1 Core / Cross-Cutting

| Module | What It Does |
|---|---|
| **Dashboard** | Central landing page — KPIs, quick stats, recent activity across all enabled modules. |
| **AI Assistant** ✨ | Built-in conversational AI ("Powered by your ERP data") — lets users ask natural-language questions about their business data and get answers/insights without navigating menus or building reports manually. A flagship differentiator. |
| **Reports** | Cross-module reporting and analytics. |
| **File Manager** | Centralized document/file storage for the organization. |
| **Master Data** | Shared reference data (categories, brands, units of measure, etc.) used across modules. |
| **Settings** | General settings, Users, Roles & Permissions, Branches, Integrations, Audit Logs, POS payment methods, Vouchers & Coupons. |
| **Super Admin** | Multi-tenant control panel — create/manage tenant organizations, assign modules per tenant. |
| **Profile** | Personal account page — user's own info, password, preferences. |
| **Careers (public)** | Public-facing job board per tenant (`/careers/:tenantSlug`) — lists open positions and job detail pages, fed by the HR Recruitment module. Lets a business publish its vacancies without a separate careers website. |

### 4.2 Finance

**Module: Finance** — full double-entry accounting suite:

| Feature | Description |
|---|---|
| **Accounting** | Chart of accounts and core bookkeeping. |
| **General Ledger** | Full GL with summary, trial balance, profit & loss, balance sheet, cash flow reports. |
| **Journal Entries / Journals** | Create, post, and void manual journal entries; rich read views with journal numbers, periods, account codes. |
| **Financial Statements** | Auto-generated P&L, Balance Sheet, Cash Flow statements. |
| **Invoicing** | Customer invoices — create, send, mark paid, cancel. |
| **Recurring Invoices** | Automated recurring billing for subscriptions/retainers. |
| **Expenses** | Expense tracking with approve/reject/pay workflow. |
| **Budgeting** | Departmental/project budgets vs. actuals. |
| **Tax & VAT** | VAT configuration and tax reporting (GCC-ready). |
| **Bank & Cash (Banking)** | Bank account management, transactions, reconciliation. |

This module is also the **architectural reference implementation** for the rest of the platform (clean
CQRS/MediatR pattern) — meaning Finance is the most mature, best-structured module in the codebase.

### 4.3 People

**HR & Payroll:**

| Feature | Description |
|---|---|
| **Employees** | Full employee records — personal info, job details, salary, bank/IBAN. |
| **Attendance** | Full CRUD attendance tracking — mark present/absent/half-day, check-in/out times, bulk operations ("Mark All Present/Absent"). |
| **Payroll** | Full payroll run lifecycle: draft → processed → paid, with reject/reopen/edit flows. Per-employee allowances/deductions, "Apply to All" bulk adjustments, audit trail (who created/rejected/when). |
| **Leave Management** | Leave requests, approvals, balances. |
| **Recruitment** | Job postings and candidate pipeline (UI scaffolded). |
| **Performance** | Performance review tracking (beta). |

**WPS (Wage Protection System):** Generates **UAE Central Bank-compliant SIF payroll files** directly from
payroll runs — a critical compliance feature for any UAE-based employer, built into the Payroll module.

**CRM (Customer Relationship Management):**

| Feature | Description |
|---|---|
| **CRM Dashboard** | Sales/relationship KPIs at a glance. |
| **Leads** | Lead capture and qualification tracking. |
| **Pipeline** | Visual sales pipeline / deal stages. |
| **Customers** | Customer database, shared across CRM and Sales. |
| **Activities** | Logged calls, meetings, tasks, follow-ups tied to leads/customers. |

### 4.4 Operations (Commerce)

| Module | What It Does |
|---|---|
| **Sales** | Quotations → Sales Orders → Returns. The full order-to-cash front-office flow for B2B/wholesale-style selling. |
| **Purchase** | Vendor management, Purchase Orders, multi-level Approvals workflow. |
| **Inventory** | Warehouses, Stock Items, Stock Movements (receipts/write-offs/adjustments/count-corrections), Stock Transfers (with submit/approve/receive workflow), and Master Data (Categories, Brands, Units of Measure). |

### 4.5 Point of Sale (POS)

| Feature | Description |
|---|---|
| **Retail POS** | Cash-register style point-of-sale for shops — sessions, discounts, loyalty points. |
| **Restaurant POS** | Table/order-based POS for F&B businesses. |
| **Kitchen Display System (KDS)** | Live order ticket screen for kitchen staff (restaurant module). |
| **Recipe Management** | Recipes & ingredients — links menu items to inventory consumption (ideal for F&B costing). |

POS supports **printer integration** (network/Windows printers for receipts), **discount controls**, and a
**loyalty points** system out of the box.

### 4.6 Industry Packs (Vertical Modules)

These are specialized modules that turn Vrodux from a generic ERP into an **industry-specific system** —
a major differentiator vs. generic ERPs that need heavy customization for verticals.

| Industry Module | Sub-Features |
|---|---|
| **Real Estate** | Sales Pipeline, Properties, Units, Tenants, Contracts, Brokers — covers brokerage, leasing, and property management end-to-end. |
| **Construction** | Bidding & Contracts, Projects, BOQ (Bill of Quantities), Contractors, Site Management — covers the full project lifecycle from tender to site execution. |
| **Hospitality** | Bookings, Rooms, Housekeeping — hotel/resort operations (beta). |
| **Healthcare** | Patients & Care — appointments, patient records, billing groundwork. |
| **Education** | Admissions & Students — student records, courses, fee management groundwork. |
| **Insurance** | Policies & Claims — policy administration and claims tracking groundwork. |
| **B2B Services** | Proposals & Contracts — for service-based B2B businesses (consultancies, agencies). |

### 4.7 Accounts, Roles & Access Control ("Workspace Administration")

This is the **control layer** that sits underneath every other module — it governs *who* can log in, *what*
they're allowed to see/do, *how the workspace is configured*, and *how the subscription itself is managed*. In
the codebase this is the `Identity` service, but from a product/branding perspective it should be presented as
**Workspace Administration / Account & Access Management** — it's the "back office of the back office."

| Feature Area | What It Does |
|---|---|
| **Authentication** | Register, Login, Refresh Token, Revoke Token (logout), Forgot Password, Reset Password — JWT access + refresh token model with HMAC-SHA256 challenge-response nonces for sensitive flows (e.g., trial signup) and rate-limiting on password-reset to prevent abuse/enumeration. |
| **My Account ("Me")** | Every logged-in user can view and update their own profile (`/auth/me`) and change their own password — separate from admin-driven user management. |
| **User Management** | Admins can list, create, edit, and delete users; assign or remove roles per user; force a **password change**, or perform an **admin-initiated password reset** (no need to know the user's current password — critical for IT/HR support scenarios). |
| **Roles & Permissions (RBAC)** | Full **Role-Based Access Control**. Admins create custom roles (e.g., "Branch Manager", "Cashier", "Accountant"), each with its own **permission matrix**. Roles can be edited, renamed, or deleted, and their permission sets replaced wholesale via a single "update permissions" action. |
| **Permission Catalogue** | A canonical, seeded list of **every permission in the system**, organized by module and action. Each module (Inventory, POS, Finance, HR, CRM, Sales, Purchase, Settings, etc.) exposes its own set of fine-grained actions — e.g. `view`, `create`, `edit`, `delete`, `approve`, `export`, `print`, `void`, `refund`, `discount`, `adjust`. This means access can be controlled down to "can this role issue a POS refund?" or "can this role approve a purchase order?" — not just blanket module on/off switches. |
| **Branches** | Full CRUD for company branches/locations — supports the multi-branch/multi-location business model (e.g., a retail chain with several stores, each potentially with its own staff and stock). |
| **App / Workspace Settings** | Centralized settings store, organized by category (general info, regional/locale, etc.) — read or update a single category, or fetch/update everything at once. Powers the "Settings → General" screens. |
| **Audit Logs** | A queryable, exportable trail of who-did-what-when across the workspace — supports compliance and internal accountability (e.g., "who approved this payroll run", "who changed this user's role"). |
| **Tenant / Subscription Administration** | The Super Admin layer for managing every customer workspace ("tenant") from one place: create tenants, view/update tenant details, change subscription **plan**, **activate/suspend/expire** a tenant, manage **module entitlements** per tenant (which of the 20+ modules a tenant has paid for/enabled), update a tenant's **industry**, view user counts, and manage per-tenant database connection strings (for dedicated-database tenants). |
| **Licensing** | License **validation** and **heartbeat** endpoints — supports a license-key-based activation/compliance model for deployed instances (on-prem or isolated tenants), so the platform can verify a workspace is on a valid, current subscription. |
| **Trial / Self-Signup** | A secure, public self-service signup flow (`/trial`) — issues a cryptographic **challenge** (HMAC-SHA256 nonce, single-use via `IMemoryCache`) before allowing registration, preventing bot/automated account creation. This is what powers the 4-step onboarding wizard described in Section 3. |

**Why this matters for branding:** This layer is what makes Vrodux genuinely **enterprise-ready** and
**SaaS-ready** at the same time. A small business gets simple, sensible role presets (Admin, Manager, Cashier,
Accountant, etc.); a larger or multi-branch business gets **granular, per-action permission control** down to
individual buttons (export, void, refund, approve); and Softaxis (as the platform owner) gets full **tenant
lifecycle management** — onboarding, licensing, plan upgrades/downgrades, suspension, and module entitlement —
without touching a database by hand. Competing ERPs often treat permissions as an afterthought (module-level
on/off only) or require a separate admin tool entirely for tenant/subscription management; Vrodux bakes both
into the same platform.

---

## 5. Technology Foundation (Why It's Built to Last)

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite + TypeScript, Tailwind CSS, Framer Motion (animations), React Hook Form + Zod (validated forms), TanStack Query (live data sync/caching), Sonner (notifications) |
| **Backend** | ASP.NET Core (.NET 10), **microservices architecture** — separate services per domain (Identity, HR, Finance, CRM, Inventory, Sales, Purchase, POS, Construction, RealEstate, Hospitality, Restaurant, Recipe) |
| **Architecture pattern** | CQRS + MediatR (Command/Query Responsibility Segregation) — every feature is built as Commands, Queries, Handlers, and DTOs, cleanly separated from controllers. This is enforced as the mandatory standard for all new backend code. |
| **Database** | Entity Framework Core (SQL Server) |
| **Auth & Security** | JWT access + refresh tokens, HMAC-SHA256 challenge-response nonces, rate-limited sensitive endpoints (e.g., forgot-password), role-based permissions, audit logging |
| **API Gateway** | Single gateway routes requests to the correct backend microservice — frontend talks to one API surface |
| **Internationalization** | Bilingual UI (English / Arabic with RTL labels) baked into navigation and forms |
| **Exports** | Built-in CSV export and zero-dependency, browser-native PDF export/printing across all major list views |

**Why this matters for branding:** The microservices + CQRS architecture means each module (Finance, HR, CRM,
etc.) can be developed, scaled, and deployed independently — the system can grow a new industry vertical without
risking the stability of existing modules. This is the kind of architecture used by large-scale SaaS platforms,
not typical of small-business ERPs.

---

## 6. What Makes Vrodux ERP Different (Competitive Advantages)

1. **One Platform, Pick-Your-Modules** — Unlike legacy ERPs (SAP, Oracle, even mid-market players like Odoo
   modules bundles) that force a one-size-fits-all setup or require expensive consultants to configure, Vrodux's
   onboarding lets a business select **exactly** the modules it needs in minutes, with smart dependency
   resolution — no IT department required.

2. **True Industry Verticals Built-In** — Real Estate, Construction, Hospitality, Healthcare, Education,
   Insurance, and B2B Services are **first-class modules**, not bolted-on customizations. A construction company
   gets BOQ and site management out of the box; a real estate brokerage gets tenant/contract/broker management
   out of the box.

3. **Built-in AI Assistant** — Most ERPs require third-party BI tools or custom dashboards to get insights.
   Vrodux ships with a conversational AI assistant that answers questions directly from live ERP data.

4. **GCC/UAE Compliance Out of the Box** — Native VAT/Tax module and **automatic UAE WPS (Wage Protection
   System) payroll file generation** — a feature many competitors charge extra for or don't support at all.

5. **Modern, Fast, Mobile-Friendly UI** — Built on React + Tailwind with smooth animations (Framer Motion),
   dark mode, and bilingual (English/Arabic, RTL-ready) — a stark contrast to the dated, clunky interfaces of
   traditional ERPs (SAP, legacy Oracle, Tally, older QuickBooks Desktop-style tools).

6. **Real-Time, Connected Data** — Sales, Inventory, Finance, HR, and CRM all share the same customer/employee/
   product master data and update in real time (via TanStack Query) — no end-of-day batch syncs or manual
   exports between disconnected systems.

7. **Multi-Tenant SaaS-Ready** — A Super Admin layer lets Softaxis (or a reseller) onboard and manage many
   client organizations from a single control plane — enabling a true SaaS business model, not just
   single-installation software.

8. **Modern Payroll & HR Workflow** — Full payroll status machine (draft → processed → paid, with reject/edit/
   resubmit cycles), creator/rejector audit trails, per-employee bonus adjustments with bulk "Apply to All" —
   far more flexible than rigid "run payroll once a month" tools.

9. **No Dead UI / Fully Wired Workflows** — Every button, export, confirmation, and form across the platform is
   functionally wired to real backend operations with proper error handling and toasts — the result of an
   extensive QA pass (documented internally) eliminating "decorative" buttons common in early-stage ERP products.

10. **Zero-Dependency Reporting Exports** — CSV and branded PDF exports work natively in the browser across
    every major list view (Employees, Leaves, Invoices, Expenses, Budgets, Leads, Customers, Pipeline, etc.)
    without requiring server-side report engines.

---

## 7. High-Level System Map

```
                              ┌─────────────────────────┐
                              │      Vrodux ERP UI       │
                              │  (React + Vite + TS)     │
                              │  Single login, one app   │
                              └────────────┬─────────────┘
                                            │
                              ┌────────────▼─────────────┐
                              │       API Gateway         │
                              └────────────┬─────────────┘
        ┌──────────┬──────────┬────────────┼────────────┬──────────────┬──────────────┐
        ▼          ▼          ▼            ▼            ▼              ▼              ▼
   Identity     Finance      HR          CRM        Inventory       Sales         Purchase
  (Auth/Users) (Accounting, (Employees, (Leads,    (Stock, WHs,   (Quotes,       (Vendors,
               Invoicing,   Payroll,     Pipeline,  Transfers)     Orders,        POs,
               GL, Tax,     Attendance,  Customers)                Returns)       Approvals)
               Banking)     Leaves)

        ▼          ▼          ▼            ▼            ▼              ▼
      POS      Construction  RealEstate  Hospitality  Restaurant    Recipe
   (Retail,    (Projects,    (Properties, (Bookings,   (Tables,     (Recipes,
    Restaurant, BOQ,          Units,       Rooms,       Orders,      Ingredients)
    KDS)        Contractors)  Tenants,     Housekeeping) KDS)
                              Contracts,
                              Brokers)

   + Healthcare, Education, Insurance, B2B Services (vertical modules)
   + Super Admin (multi-tenant management) sits above all services
```

---

## 8. Quick Reference: Module → Business Value

| Module | "So what?" — Business Value in One Line |
|---|---|
| Dashboard | See your whole business at a glance, the moment you log in. |
| AI Assistant | Ask your business questions in plain English — no reports to build. |
| Finance | Replace spreadsheets and standalone accounting software with real-time books. |
| HR & Payroll | Run payroll, track attendance, and stay UAE WPS-compliant — automatically. |
| CRM | Never lose a lead — track every customer relationship from first contact to deal close. |
| Sales | Turn quotes into orders into revenue, with full visibility. |
| Purchase | Control spending with vendor management and approval workflows. |
| Inventory | Always know what stock you have, where it is, and when to reorder. |
| POS (Retail/Restaurant) | Sell fast, in-store or at the table, fully connected to inventory and finance. |
| Recipe | Know the true cost of every dish you sell. |
| Real Estate | Manage your entire portfolio — properties, tenants, leases, brokers — in one place. |
| Construction | Bid, plan, and execute projects with BOQ and site tracking built in. |
| Hospitality | Run front-desk, rooms, and housekeeping from one screen. |
| Healthcare / Education / Insurance / B2B | Industry-specific operations without buying a separate niche system. |
| Reports / Exports | Get the numbers out — to Excel or a polished PDF — in one click. |
| Branches / Super Admin | Run multiple locations or multiple client companies from one account. |
| Workspace Administration (Accounts, Roles & Access) | Control exactly who can do what — down to individual buttons like export, void, refund, and approve — and manage the subscription itself. |

---

## 9. Summary for AI Agents

If a user asks **"what is this system / what can it do"**:
- It is **Vrodux ERP**, a modular multi-tenant ERP web app by **Softaxis**.
- It serves **retail, F&B, services, and vertical industries** (real estate, construction, hospitality,
  healthcare, education, insurance, B2B).
- Core modules: **Dashboard, AI Assistant, Finance, HR & Payroll, CRM, Sales, Purchase, Inventory, POS
  (Retail/Restaurant), Recipe, Reports, File Manager, Settings**.
- Industry/vertical modules: **Real Estate, Construction, Hospitality, Healthcare, Education, Insurance, B2B
  Services**.
- Underlying control layer: **Workspace Administration** — authentication, user management, role-based access
  control with a granular per-action permission matrix, branches, audit logs, app settings, and (for Softaxis)
  full tenant/subscription/licensing administration. See Section 4.7.
- Differentiators: **modular onboarding (pick-your-modules), built-in AI assistant, UAE/GCC compliance (VAT +
  WPS), modern bilingual UI, microservices/CQRS architecture, granular RBAC, multi-tenant Super Admin layer**.
- Architecture standard for backend code: **CQRS/MediatR**, with `Softaxis.Finance.*` Accounts feature as the
  reference implementation (see `CLAUDE.md` for the technical standard).
