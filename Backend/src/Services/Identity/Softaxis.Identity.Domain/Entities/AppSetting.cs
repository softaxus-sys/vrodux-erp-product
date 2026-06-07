namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Key-value store for application settings.
/// Grouped by category (company, regional, appearance, notifications, security, modules).
///
/// Scoping:
///   UserId = null  → company-wide setting  (company, regional, notifications, security, modules)
///   UserId = "{id}" → per-user setting      (appearance — theme, compactMode, etc.)
/// </summary>
public sealed class AppSetting
{
    private AppSetting() { }

    /// <summary>Company-wide setting (UserId = null).</summary>
    public AppSetting(string category, string key, string value, string? updatedBy = null)
    {
        Id        = Guid.NewGuid();
        Category  = category.Trim().ToLowerInvariant();
        Key       = key.Trim();
        Value     = value;
        UserId    = null;   // company-wide
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy ?? "system";
    }

    /// <summary>Per-user setting (UserId = caller's identity).</summary>
    public AppSetting(string category, string key, string value, string userId, string? updatedBy = null)
    {
        Id        = Guid.NewGuid();
        Category  = category.Trim().ToLowerInvariant();
        Key       = key.Trim();
        Value     = value;
        UserId    = userId;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy ?? userId;
    }

    public Guid     Id        { get; private set; }
    /// <summary>company | regional | appearance | notifications | security | modules</summary>
    public string   Category  { get; private set; } = string.Empty;
    public string   Key       { get; private set; } = string.Empty;
    public string   Value     { get; private set; } = string.Empty;
    /// <summary>Null = company-wide. Non-null = per-user (e.g. appearance).</summary>
    public string?  UserId    { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public string   UpdatedBy { get; private set; } = "system";

    public void SetValue(string value, string? updatedBy = null)
    {
        Value     = value;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy ?? "system";
    }
}
