namespace Softaxis.Identity.Application.DTOs;

/// <summary>
/// An access token minted for a user by an internal, server-side caller (no password). Used by the
/// AI Assistant to act as a linked Telegram user through the normal auth pipeline. Never exposed
/// via a public endpoint.
/// </summary>
public sealed record ServiceTokenDto(
    string AccessToken,
    Guid UserId,
    string Username,
    string? Email,
    bool IsSuperAdmin,
    Guid? TenantId,
    IReadOnlyList<string> Permissions);
