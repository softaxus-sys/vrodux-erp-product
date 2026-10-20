namespace Softaxis.BuildingBlocks.Infrastructure.Storage;

/// <summary>
/// One bucket for the whole Vrodux backend — every module's files live in it under their own key
/// prefix (e.g. "real-estate/{tenantId}/{propertyId}/{imageId}"), rather than one bucket per
/// module. Qasro, a separate product/deployment, has its own bucket and its own credentials
/// entirely outside this config — the two are never meant to share a key or a credential.
/// </summary>
public sealed class ObjectStorageOptions
{
    public const string Section = "Storage";

    /// <summary>The S3-compatible endpoint, e.g. "https://eu2.contabostorage.com" — no bucket name
    /// in this URL, that's a separate field.</summary>
    public string Endpoint { get; set; } = string.Empty;
    public string Bucket { get; set; } = string.Empty;
    public string AccessKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;

    /// <summary>The bucket's provisioned capacity, for the super-admin storage-usage dashboard —
    /// this is informational only (nothing enforces it), config-driven since the provisioned size
    /// is an infrastructure fact, not something to hardcode. Defaults to the 250GB currently
    /// provisioned on Contabo.</summary>
    public int BudgetGb { get; set; } = 250;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Endpoint) && !string.IsNullOrWhiteSpace(Bucket) &&
        !string.IsNullOrWhiteSpace(AccessKey) && !string.IsNullOrWhiteSpace(SecretKey);
}
