namespace Softaxis.POS.Application.PaymentGateway.Dtos;

/// <summary>Never carries the decrypted secret — HasApiKey/HasSecretKey are booleans so the settings
/// UI can show "configured" without ever round-tripping the actual key back to the browser.</summary>
public sealed record PaymentGatewayConfigDto(
    string Provider, bool HasApiKey, bool HasSecretKey, string? PublicKey, string Mode, bool IsEnabled);

public sealed record PaymentGatewayCatalogEntryDto(
    string Key, string DisplayName, string Status, // "active" | "coming_soon"
    bool NeedsApiKey, bool NeedsSecretKey, bool NeedsPublicKey, string SetupHint);
