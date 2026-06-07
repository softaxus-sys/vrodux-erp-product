using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.AppSettings.Queries.GetSettingsCategory;

/// <summary>Returns a single category as { key → value }.</summary>
public sealed record GetSettingsCategoryQuery(string Category, string CurrentUserId)
    : IQuery<Dictionary<string, string>>;
