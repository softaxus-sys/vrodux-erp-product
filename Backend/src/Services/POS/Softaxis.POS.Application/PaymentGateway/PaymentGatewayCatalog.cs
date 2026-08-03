using Softaxis.POS.Application.PaymentGateway.Dtos;

namespace Softaxis.POS.Application.PaymentGateway;

/// <summary>
/// Declarative catalog of payment gateways — same "catalog card, manual is the only always-active
/// entry, everything else is coming_soon until a real adapter is wired" pattern as VisaServices'
/// government channels (Module 15) and the CRM/Restaurant delivery-provider catalogs. Credential
/// storage for every entry is real today; live charge processing for a specific gateway is a
/// follow-up once that partnership/integration is actually built (a live card charge also needs a
/// frontend tokenization flow — never collect raw card data server-side, see PaymentGatewayConfig).
/// </summary>
public static class PaymentGatewayCatalog
{
    public static IReadOnlyList<PaymentGatewayCatalogEntryDto> All { get; } =
    [
        new("manual", "Manual / Terminal", "active", false, false, false,
            "No online gateway — card and cash payments go through your physical terminal exactly as today. This is the default."),
        new("stripe", "Stripe", "coming_soon", true, true, true,
            "Store your Stripe secret + publishable key here now; live PaymentIntent creation ships in a follow-up once card tokenization is added to the checkout UI."),
        new("paytabs", "PayTabs", "coming_soon", true, true, false,
            "UAE/GCC-focused gateway. Store your Server Key + Profile ID here now; live processing is a follow-up."),
        new("telr", "Telr", "coming_soon", true, true, false,
            "UAE/GCC-focused gateway. Store your Store ID + Auth Key here now; live processing is a follow-up."),
        new("network_international", "Network International", "coming_soon", true, true, false,
            "UAE-focused gateway. Store your API credentials here now; live processing is a follow-up."),
    ];
}
