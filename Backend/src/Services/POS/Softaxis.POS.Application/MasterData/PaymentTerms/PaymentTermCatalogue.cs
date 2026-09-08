using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Application.MasterData.PaymentTerms;

/// <summary>
/// Default payment-term catalogue. PaymentTerm is tenant-owned, so these are seeded lazily into a
/// tenant the first time it reads an empty list (each tenant gets its own editable copy — see
/// GetPaymentTermsQueryHandler). Mirrors the original global `HasData` rows from
/// PaymentTermConfiguration, which were stamped with no TenantId and are therefore invisible to
/// every real tenant under the tenant-isolation query filter. Returns fresh instances on every call.
/// </summary>
public static class PaymentTermCatalogue
{
    public static IReadOnlyList<PaymentTerm> BuildDefaults()
    {
        (string Name, string Code, int DaysNet, decimal AdvancePercent, string Description, bool IsDefault)[] rows =
        [
            ("Immediate",        "IMMEDIATE", 0,  0m,   "Payment due immediately on invoice",             true),
            ("Cash on Delivery", "COD",       0,  0m,   "Full payment collected on delivery",              false),
            ("Prepaid",          "PRE",       0,  100m, "Full prepayment required before dispatch",        false),
            ("Net 15",           "NET15",     15, 0m,   "Payment due within 15 days of invoice",           false),
            ("Net 30",           "NET30",     30, 0m,   "Payment due within 30 days of invoice",           false),
            ("Net 45",           "NET45",     45, 0m,   "Payment due within 45 days of invoice",           false),
            ("Net 60",           "NET60",     60, 0m,   "Payment due within 60 days of invoice",           false),
            ("Net 90",           "NET90",     90, 0m,   "Payment due within 90 days of invoice",           false),
            ("30% Advance",      "ADV30",     30, 30m,  "30% advance required, balance within 30 days",    false),
            ("50% Advance",      "ADV50",     30, 50m,  "50% advance required, balance within 30 days",    false),
            ("2/10 Net 30",      "2NET30",    30, 0m,   "2% discount if paid within 10 days, else Net 30", false),
        ];

        return rows.Select(r =>
        {
            var term = PaymentTerm.Create(r.Name, r.Code, r.DaysNet, r.AdvancePercent, r.Description, r.IsDefault, isSystem: true).Value;
            term.CreatedAt = DateTime.UtcNow;
            return term;
        }).ToList();
    }
}
