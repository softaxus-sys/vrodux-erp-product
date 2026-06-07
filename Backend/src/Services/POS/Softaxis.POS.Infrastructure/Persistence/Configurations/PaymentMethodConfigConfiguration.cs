using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class PaymentMethodConfigConfiguration
    : IEntityTypeConfiguration<PaymentMethodConfig>
{
    public void Configure(EntityTypeBuilder<PaymentMethodConfig> builder)
    {
        builder.ToTable("payment_method_configs");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();

        builder.Property(m => m.Code)
            .IsRequired()
            .HasMaxLength(80);

        builder.Property(m => m.Label)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(m => m.IconKey)
            .IsRequired()
            .HasMaxLength(60);

        builder.Property(m => m.Countries)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(m => m.Description)
            .HasMaxLength(300);

        builder.HasIndex(m => m.Code)
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");

        builder.HasQueryFilter(m => !m.IsDeleted);

        // ── Seed data — full master registry ─────────────────────────────────
        // SortOrder: 1–3 = universal, 10+ = country-specific
        // IsEnabled: true for universally safe defaults; false for country-specific
        //            (frontend applies country-seed logic on first use)

        builder.HasData(

            // ── Universal ──────────────────────────────────────────────────
            Row("b0000001-0000-0000-0000-000000000001", "Cash",        "Cash",         "banknote",    "*",           "Physical cash payment",                1,  enabled: true),
            Row("b0000001-0000-0000-0000-000000000002", "Card",        "Card",         "credit-card", "*",           "Visa / Mastercard / Amex / Debit",     2,  enabled: true),
            Row("b0000001-0000-0000-0000-000000000003", "BankTransfer","Bank Transfer", "landmark",    "*",           "Wire / SWIFT / IBAN / SEPA",           90, enabled: false),
            Row("b0000001-0000-0000-0000-000000000004", "Cheque",      "Cheque",        "file-text",   "ae,gb,us,pk,sa","Post-dated or bearer cheque",        91, enabled: false),

            // ── Pakistan ───────────────────────────────────────────────────
            Row("b0000002-0000-0000-0000-000000000001", "EasyPaisa",   "EasyPaisa",    "smartphone",  "pk",          "Telenor mobile wallet",               10,  enabled: false),
            Row("b0000002-0000-0000-0000-000000000002", "JazzCash",    "JazzCash",     "smartphone",  "pk",          "Jazz mobile wallet",                  11,  enabled: false),
            Row("b0000002-0000-0000-0000-000000000003", "SadaPay",     "SadaPay",      "wallet",      "pk",          "SadaPay digital wallet",              12,  enabled: false),
            Row("b0000002-0000-0000-0000-000000000004", "NayaPay",     "NayaPay",      "wallet",      "pk",          "NayaPay e-money wallet",              13,  enabled: false),

            // ── UAE ────────────────────────────────────────────────────────
            Row("b0000003-0000-0000-0000-000000000001", "ApplePay",    "Apple Pay",    "smartphone",  "ae,sa,gb,us,in","Apple NFC contactless",             10,  enabled: false),
            Row("b0000003-0000-0000-0000-000000000002", "GooglePay",   "Google Pay",   "wallet",      "ae,sa,gb,us,in","Google Pay / GPay",                 11,  enabled: false),
            Row("b0000003-0000-0000-0000-000000000003", "SamsungPay",  "Samsung Pay",  "smartphone",  "ae,sa",       "Samsung NFC wallet",                  12,  enabled: false),
            Row("b0000003-0000-0000-0000-000000000004", "Tabby",       "Tabby (BNPL)", "tag",         "ae,sa",       "Buy Now Pay Later — Tabby",           20,  enabled: false),
            Row("b0000003-0000-0000-0000-000000000005", "Tamara",      "Tamara (BNPL)","tag",         "ae,sa",       "Buy Now Pay Later — Tamara",          21,  enabled: false),

            // ── Saudi Arabia ───────────────────────────────────────────────
            Row("b0000004-0000-0000-0000-000000000001", "STCPay",      "STC Pay",      "smartphone",  "sa",          "STC mobile wallet (KSA)",             10,  enabled: false),
            Row("b0000004-0000-0000-0000-000000000002", "Mada",        "Mada",         "credit-card", "sa",          "Saudi national debit network",        11,  enabled: false),

            // ── India ──────────────────────────────────────────────────────
            Row("b0000005-0000-0000-0000-000000000001", "UPI",         "UPI",          "smartphone",  "in",          "Unified Payments Interface",          10,  enabled: false),
            Row("b0000005-0000-0000-0000-000000000002", "PhonePe",     "PhonePe",      "smartphone",  "in",          "PhonePe UPI wallet",                  11,  enabled: false),
            Row("b0000005-0000-0000-0000-000000000003", "Paytm",       "Paytm",        "wallet",      "in",          "Paytm wallet & UPI",                  12,  enabled: false),

            // ── United Kingdom ─────────────────────────────────────────────
            Row("b0000006-0000-0000-0000-000000000001", "ContactlessGBP","Contactless","credit-card", "gb",          "Contactless card / device",           10,  enabled: false),

            // ── United States ──────────────────────────────────────────────
            Row("b0000007-0000-0000-0000-000000000001", "Zelle",       "Zelle",        "landmark",    "us",          "Zelle bank-to-bank transfer",         10,  enabled: false),
            Row("b0000007-0000-0000-0000-000000000002", "Venmo",       "Venmo",        "wallet",      "us",          "Venmo social payments",               11,  enabled: false)
        );
    }

    /// Convenience helper — avoids repeating every nullable/audit field in HasData.
    private static object Row(
        string id, string code, string label,
        string iconKey, string countries, string description,
        int sortOrder, bool enabled) => new
    {
        Id          = new Guid(id),
        Code        = code,
        Label       = label,
        IconKey     = iconKey,
        Countries   = countries,
        Description = (string?)description,
        SortOrder   = sortOrder,
        IsEnabled   = enabled,
        IsSystem    = true,
        IsDeleted   = false,
        CreatedAt   = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        CreatedBy   = "system",
        UpdatedAt   = (DateTime?)null,
        UpdatedBy   = (string?)null,
        DeletedAt   = (DateTime?)null,
        DeletedBy   = (string?)null,
    };
}
