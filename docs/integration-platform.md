# Vrodux Integration Platform

The Integration Platform lets every tenant connect external lead sources (Meta, webhooks,
website forms, and more). Leads from any source flow through **one pipeline** into the CRM —
field mapping → duplicate detection → lead creation → routing → automations. Adding a new
source is a single provider class plus one DI line; **no CRM or pipeline code changes.**

It lives inside the **CRM service** (`Softaxis.CRM.*`, schema `crm`) and follows the existing
CQRS / MediatR / `Result<T>` patterns and the tenant-isolation model used everywhere in Vrodux.

---

## 1. Architecture

```
External source ──► Provider (normalize) ──► RawLeadInbox (durable, fast 200)
                                                   │
                                   RawLeadInboxProcessor (BackgroundService, retry)
                                                   │
                                       ILeadIntakeService  ── the ONE pipeline
                                   ┌───────────────┼───────────────┐
                            field mapping     duplicate         routing /
                                              detection         assignment
                                                   │
                                          Lead + LeadSource (provenance)
                                                   │
                                     LeadIngestedNotification (automations)
```

- **Modular monolith.** CRM is hosted in-process by `Softaxis.ApiGateway`, so lead creation is
  a method call in the same `CrmDbContext` transaction — no cross-service HTTP, no broker.
- **Strategy + Factory.** `ILeadProvider` implementations are discovered from DI by
  `ILeadProviderRegistry`. Capability interfaces (`IOAuthLeadProvider`, `IWebhookLeadProvider`,
  `IAsyncLeadProvider`, `IPollSyncLeadProvider`) let the pipeline branch on what a provider supports.
- **Single funnel.** `ILeadIntakeService.IngestAsync` is the only code that writes a `Lead`.
  The internal endpoint, the webhook processor, and future providers all go through it.
- **Tenant isolation.** All entities live under `Softaxis.CRM.Domain`, so `CrmDbContext` adds the
  shadow `TenantId` column + global query filter automatically. Anonymous paths (webhooks, OAuth
  callback) resolve the tenant from the inbound key / signed state and **stamp `TenantId` explicitly**
  (the ambient tenant is unresolved for anonymous requests).
- **Async + retry.** Webhooks persist to `RawLeadInbox` and return `200` immediately;
  `RawLeadInboxProcessor` (a `BackgroundService`) drains the inbox per tenant with exponential
  backoff (max 5 attempts).
- **Secrets encrypted.** OAuth tokens, API keys, page tokens, and HMAC secrets are encrypted at
  rest via ASP.NET Core Data Protection (`ISecretProtector`); keys persisted under the gateway's
  `App_Data/dp-keys`. Decrypted secrets are never returned except the reveal-secret endpoint
  (editors only).

---

## 2. Database (schema `crm`, migration `AddLeadIntegrations`)

| Table | Purpose |
|---|---|
| `integrations` | One per tenant↔provider connection. Status, health, encrypted `Credentials`/`SigningSecret`, `InboundKey`, dedupe/routing JSON, telemetry. |
| `integration_field_mappings` | Source field → canonical lead field, per integration. |
| `integration_resources` | Selected provider objects (Facebook page/form, sheet…). Per-resource encrypted `AccessToken`. |
| `integration_sync_logs` | One row per sync run (Sync History tab + health). |
| `integration_raw_leads` | Durable inbox: raw payload, status, attempts, backoff, created lead id (Error Log + retry queue). |
| `lead_sources` | 1:1 provenance for each created `Lead`: external id, campaign/adset/ad/page/form, UTM, raw JSON. The core `Lead` table is untouched. |

Every table carries the shadow `TenantId` column + index.

---

## 3. API

### Management (JWT, `settings.integrations.*`)
| Method | Route | Permission |
|---|---|---|
| GET | `/api/crm/integrations/catalog` | view |
| GET | `/api/crm/integrations` | view |
| GET | `/api/crm/integrations/{id}` | view |
| GET | `/api/crm/integrations/{id}/sync-logs` | view |
| GET | `/api/crm/integrations/{id}/inbox?status=` | view |
| GET | `/api/crm/integrations/{id}/secret` | edit (reveals inbound URL + HMAC secret) |
| POST | `/api/crm/integrations` `{providerKey,name?}` | edit |
| PUT | `/api/crm/integrations/{id}/config` `{config?,dedupeConfig?,routingConfig?,fieldMappings?}` | edit |
| PUT | `/api/crm/integrations/{id}/api-key` `{apiKey}` | edit |
| POST | `/api/crm/integrations/{id}/rotate-key` | edit |
| POST | `/api/crm/integrations/{id}/disconnect` | edit |
| DELETE | `/api/crm/integrations/{id}` | edit |

### Internal pipeline (JWT)
`POST /api/internal/leads` — push a canonical lead (`firstName,lastName,fullName,email,phone,
company,title,industry,address,city,country,notes,source,campaign,fields{}`). Returns
`{outcome: created|duplicate|rejected, leadId, message}`.

### Inbound (anonymous, resolved by inbound key)
| Method | Route | Notes |
|---|---|---|
| GET | `/api/webhooks/{inboundKey}` | Provider verification handshake (e.g. Meta `hub.challenge`). |
| POST | `/api/webhooks/{inboundKey}` | Receive a lead (JSON or HTML form). Stored + acked immediately. |
| GET | `/api/webhooks/{inboundKey}/snippet.js` | Website capture snippet. |

### Meta OAuth (JWT except the callback)
`POST /meta/{id}/oauth/start` → `{url}`; `GET /meta/oauth/callback` (anonymous);
`GET /meta/{id}/pages`; `GET /meta/{id}/forms?pageId=`; `POST /meta/{id}/select {pages:[{pageId,forms:[{formId,name}]}]}`.

---

## 4. Webhooks & Custom API

Create a `webhook` / `custom-api` / `zapier` / `make` / `website` integration → it is **connected
immediately** and gets an unguessable inbound URL: `{PublicBaseUrl}/api/webhooks/{inboundKey}`.

- **Auth:** possession of the inbound key is the baseline secret. For HMAC, sign the raw body
  with the integration's signing secret and send `X-Vrodux-Signature: sha256=<hex>` (also accepts
  `X-Signature` / `X-Hub-Signature-256`). Reveal the secret via the `/secret` endpoint.
- **Payload:** any JSON object, a bare array, or `{ "data": [...] }`. Common field names
  (`email`, `phone`, `full_name`, `company`, `utm_*`, …) are auto-detected; anything else is
  available to **Field Mapping**.
- **Website forms:** embed `<script src=".../snippet.js"></script>` and add `data-vrodux-lead` to
  any `<form>`; submissions post automatically. Optional `data-vrodux-redirect` / `data-vrodux-success`.

---

## 5. OAuth (Meta reference)

1. Create a Meta app (developers.facebook.com); add **Webhooks** + **Leads Retrieval**.
2. Configure `Meta:AppId`, `Meta:AppSecret`, `Meta:VerifyToken`, `Meta:GraphVersion` (env:
   `Meta__AppId`, …). Whitelist `{PublicBaseUrl}/api/crm/integrations/meta/oauth/callback`.
3. Set the app's webhook callback URL to a tenant's inbound URL with verify token = `Meta:VerifyToken`.
4. In the UI: **Connect** Meta → OAuth consent → pick pages & forms. Selected pages are subscribed
   to `leadgen`; page access tokens are stored encrypted.
5. On a new lead, Meta posts a `leadgen` notification → stored in the inbox → the processor calls
   `MetaLeadProvider.NormalizeAsync`, which fetches the full lead from the Graph API and maps it
   (incl. campaign/adset/ad/form attribution).

`PublicBaseUrl` must be public + HTTPS for real Meta delivery (use ngrok in dev).

---

## 6. Provider Development Guide

To add a provider (e.g. `google-ads`):

1. **Implement `ILeadProvider`** in `Softaxis.CRM.Infrastructure/Integrations/Providers/…`:
   ```csharp
   public sealed class GoogleAdsLeadProvider : ILeadProvider, IWebhookLeadProvider /*, IOAuth… */
   {
       public string Key => "google-ads";
       public ProviderDescriptor Descriptor => new("google-ads", "Google Ads Lead Forms",
           ProviderCategory.SocialAds, "…", ProviderCapabilities.Webhook | ProviderCapabilities.InboundKey);
       public IReadOnlyList<CanonicalLead> Normalize(string raw, Integration i) { /* parse → canonical */ }
       // + webhook verify / OAuth / async fetch as needed
   }
   ```
   - Add **capability interfaces** for what it supports:
     `IOAuthLeadProvider` (redirect connect), `IWebhookLeadProvider` (inbound verify),
     `IAsyncLeadProvider` (payload references a lead you must fetch — like Meta),
     `IPollSyncLeadProvider` (scheduled pull).
   - `Normalize`/`NormalizeAsync` must produce `CanonicalLead`s; put unmapped fields in
     `RawFields` so tenant Field Mapping can promote them. Keep `Normalize` pure.

2. **Register it** (replace the stub) in `InfrastructureExtensions.AddCrmInfrastructure`:
   ```csharp
   services.AddSingleton<ILeadProvider, GoogleAdsLeadProvider>();
   ```

3. **That's it.** The catalog card, connect flow, configure drawer, inbox, retry, dedupe, routing,
   provenance, and automations all work automatically. Add a logo entry in the frontend
   `LOGO` map for a branded card (optional).

**Never** write a `Lead` directly — always go through `ILeadIntakeService`. **Never** persist a
secret unencrypted — always `ISecretProtector.Protect`.

### Automations
Subscribe to lead events by implementing `INotificationHandler<LeadIngestedNotification>` in the
Infrastructure assembly (auto-registered by MediatR). Use it for tasks, email/SMS/WhatsApp,
outbound webhooks, or workflows — adding one never touches the intake pipeline.
