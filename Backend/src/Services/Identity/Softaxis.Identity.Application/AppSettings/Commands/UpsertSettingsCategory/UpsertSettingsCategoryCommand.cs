using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.AppSettings.Commands.UpsertSettingsCategory;

/// <summary>Upsert all keys for a single category.</summary>
public sealed record UpsertSettingsCategoryCommand(
    string                     Category,
    Dictionary<string, string> KeyValues,
    string                     CurrentUserId,
    string                     CurrentUserEmail)
    : ICommand<Dictionary<string, string>>;
