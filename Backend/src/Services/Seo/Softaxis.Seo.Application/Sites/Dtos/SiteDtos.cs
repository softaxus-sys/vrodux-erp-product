namespace Softaxis.Seo.Application.Sites.Dtos;

public sealed record SiteDto(
    Guid      Id,
    string    Domain,
    string    DisplayName,
    string    SnippetKey,
    string    ScanFrequency,
    string    VerificationStatus,
    DateTime? VerifiedAt,
    DateTime? LastSeenAt,
    DateTime? LastScanAt,
    DateTime? NextScanAt,
    string    Status,
    bool      GoogleConnected,
    DateTime  CreatedAt);

public sealed record CreateSiteRequest(string Domain, string DisplayName, string? ScanFrequency);
public sealed record UpdateSiteRequest(string DisplayName, string ScanFrequency);
