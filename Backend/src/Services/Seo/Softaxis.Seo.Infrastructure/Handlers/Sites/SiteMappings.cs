using Softaxis.Seo.Application.Sites.Dtos;
using Softaxis.Seo.Domain.Entities;

namespace Softaxis.Seo.Infrastructure.Handlers.Sites;

internal static class SiteMappings
{
    public static SiteDto ToDto(SeoSite s, bool googleConnected) => new(
        Id:                 s.Id,
        Domain:             s.Domain,
        DisplayName:        s.DisplayName,
        SnippetKey:         s.SnippetKey,
        ScanFrequency:      s.ScanFrequency,
        VerificationStatus: s.VerificationStatus,
        VerifiedAt:         s.VerifiedAt,
        LastSeenAt:         s.LastSeenAt,
        LastScanAt:         s.LastScanAt,
        NextScanAt:         s.NextScanAt,
        Status:             s.Status,
        GoogleConnected:    googleConnected,
        CreatedAt:          s.CreatedAt);
}
