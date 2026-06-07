using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.AppSettings.Queries.GetAllSettings;

/// <summary>
/// Returns all settings as { category → { key → value } }.
/// Company-wide categories return shared values; user-scoped categories return caller's own values.
/// </summary>
public sealed record GetAllSettingsQuery(string CurrentUserId)
    : IQuery<Dictionary<string, Dictionary<string, string>>>;
