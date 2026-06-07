using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// Represents a payment method available on the POS terminal.
///
/// System methods (IsSystem = true) are seeded from the master registry
/// and cannot be deleted — only toggled on/off.
///
/// Custom methods (IsSystem = false) are created by the tenant admin
/// from the POS Payment Methods settings page.
/// </summary>
public sealed class PaymentMethodConfig : AuditableEntity<Guid>
{
    /// <summary>Stable code key — matches the frontend registry ID (e.g. "Cash", "EasyPaisa").</summary>
    public string  Code        { get; private set; } = default!;

    /// <summary>Display label shown on POS buttons.</summary>
    public string  Label       { get; private set; } = default!;

    /// <summary>Icon identifier used by the frontend to resolve a Lucide icon.</summary>
    public string  IconKey     { get; private set; } = default!;

    /// <summary>
    /// Comma-separated ISO-3166-1 alpha-2 country codes, or "*" for universal.
    /// E.g. "pk", "ae,sa", "*"
    /// </summary>
    public string  Countries   { get; private set; } = default!;

    public string? Description { get; private set; }

    /// <summary>Display order on the POS charge screen. Lower = earlier.</summary>
    public int     SortOrder   { get; private set; }

    /// <summary>Whether this method is active on the POS screen.</summary>
    public bool    IsEnabled   { get; private set; }

    /// <summary>True for seeded registry methods; false for user-created custom methods.</summary>
    public bool    IsSystem    { get; private set; }

    private PaymentMethodConfig() { }

    // ── Factory ───────────────────────────────────────────────────────────────

    public static Result<PaymentMethodConfig> CreateSystem(
        string code, string label, string iconKey, string countries,
        string? description, int sortOrder, bool isEnabled)
    {
        if (string.IsNullOrWhiteSpace(code))
            return Result.Failure<PaymentMethodConfig>(
                Error.Custom("PaymentMethod.CodeRequired", "Code is required."));

        if (string.IsNullOrWhiteSpace(label))
            return Result.Failure<PaymentMethodConfig>(
                Error.Custom("PaymentMethod.LabelRequired", "Label is required."));

        return Result.Success(new PaymentMethodConfig
        {
            Id          = Guid.NewGuid(),
            Code        = code.Trim(),
            Label       = label.Trim(),
            IconKey     = iconKey.Trim(),
            Countries   = countries.Trim(),
            Description = description?.Trim(),
            SortOrder   = sortOrder,
            IsEnabled   = isEnabled,
            IsSystem    = true,
        });
    }

    public static Result<PaymentMethodConfig> CreateCustom(string label, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(label))
            return Result.Failure<PaymentMethodConfig>(
                Error.Custom("PaymentMethod.LabelRequired", "Label is required."));

        var code = "custom_" + label.Trim().ToLowerInvariant()
                                    .Replace(" ", "_")
                                    .Replace("-", "_");

        return Result.Success(new PaymentMethodConfig
        {
            Id          = Guid.NewGuid(),
            Code        = code,
            Label       = label.Trim(),
            IconKey     = "circle-dollar-sign",
            Countries   = "*",
            Description = "Custom payment method",
            SortOrder   = sortOrder,
            IsEnabled   = true,
            IsSystem    = false,
        });
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    public void SetEnabled(bool enabled)   => IsEnabled  = enabled;
    public void SetSortOrder(int order)    => SortOrder  = order;
    public void Rename(string label)       => Label      = label.Trim();
}
