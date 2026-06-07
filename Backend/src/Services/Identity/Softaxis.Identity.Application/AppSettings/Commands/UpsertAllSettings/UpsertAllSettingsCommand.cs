using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.AppSettings.Commands.UpsertAllSettings;

/// <summary>Save all categories at once. Each category is automatically scoped.</summary>
public sealed record UpsertAllSettingsCommand(
    Dictionary<string, Dictionary<string, string>> CategoryMap,
    string                                          CurrentUserId,
    string                                          CurrentUserEmail)
    : ICommand;
