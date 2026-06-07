using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Application.Common;

/// <summary>
/// Maps a frontend payment-method code (e.g. "EasyPaisa", "Cash", "custom_gift_card")
/// to the accounting-level <see cref="PaymentMethod"/> enum category.
///
/// Rules:
///   - Exact enum names ("Cash", "Card", …) are matched case-insensitively first.
///   - Known wallet / BNPL codes resolve to <see cref="PaymentMethod.DigitalWallet"/>.
///   - Any code starting with "custom_" resolves to <see cref="PaymentMethod.DigitalWallet"/>.
///   - Truly unknown codes return <c>null</c> → caller should reject with InvalidMethod.
/// </summary>
public static class PaymentMethodCodeResolver
{
    // ── Explicit code → category map ─────────────────────────────────────────

    private static readonly Dictionary<string, PaymentMethod> _map =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // ── Universal categories (match enum names too) ──────────────────
            ["Cash"]          = PaymentMethod.Cash,
            ["Card"]          = PaymentMethod.Card,
            ["Cheque"]        = PaymentMethod.Cheque,
            ["StoreCredit"]   = PaymentMethod.StoreCredit,
            ["BankTransfer"]  = PaymentMethod.BankTransfer,
            ["DigitalWallet"] = PaymentMethod.DigitalWallet,
            ["Mixed"]         = PaymentMethod.Mixed,

            // ── Pakistan ─────────────────────────────────────────────────────
            ["EasyPaisa"]     = PaymentMethod.DigitalWallet,
            ["JazzCash"]      = PaymentMethod.DigitalWallet,
            ["SadaPay"]       = PaymentMethod.DigitalWallet,
            ["NayaPay"]       = PaymentMethod.DigitalWallet,

            // ── UAE / GCC ────────────────────────────────────────────────────
            ["ApplePay"]      = PaymentMethod.DigitalWallet,
            ["GooglePay"]     = PaymentMethod.DigitalWallet,
            ["SamsungPay"]    = PaymentMethod.DigitalWallet,
            ["Tabby"]         = PaymentMethod.DigitalWallet,
            ["Tamara"]        = PaymentMethod.DigitalWallet,

            // ── Saudi Arabia ─────────────────────────────────────────────────
            ["STCPay"]        = PaymentMethod.DigitalWallet,
            ["Mada"]          = PaymentMethod.Card,           // national debit network

            // ── India ────────────────────────────────────────────────────────
            ["UPI"]           = PaymentMethod.DigitalWallet,
            ["PhonePe"]       = PaymentMethod.DigitalWallet,
            ["Paytm"]         = PaymentMethod.DigitalWallet,

            // ── UK ───────────────────────────────────────────────────────────
            ["ContactlessGBP"] = PaymentMethod.Card,

            // ── USA ──────────────────────────────────────────────────────────
            ["Zelle"]         = PaymentMethod.BankTransfer,
            ["Venmo"]         = PaymentMethod.DigitalWallet,
        };

    // ── Public API ────────────────────────────────────────────────────────────

    /// <summary>
    /// Resolves <paramref name="code"/> to a <see cref="PaymentMethod"/> category.
    /// Returns <c>null</c> if the code is not recognised.
    /// </summary>
    public static PaymentMethod? Resolve(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;

        // 1. Explicit map lookup
        if (_map.TryGetValue(code, out var mapped)) return mapped;

        // 2. Custom methods (code begins with "custom_") → DigitalWallet
        if (code.StartsWith("custom_", StringComparison.OrdinalIgnoreCase))
            return PaymentMethod.DigitalWallet;

        // 3. Unknown
        return null;
    }
}
