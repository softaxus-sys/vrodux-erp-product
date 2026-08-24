namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>
/// The identity the assistant should act as, when there is no authenticated HTTP user (e.g. an
/// inbound Telegram message from a linked user). Carries everything <see cref="ICurrentUser"/>
/// needs so tools still run tenant- and permission-scoped.
/// </summary>
public sealed record AiImpersonatedUser(
    Guid Id,
    string? Username,
    string? Email,
    bool IsSuperAdmin,
    IReadOnlySet<string> Permissions,
    string BearerToken,
    string BaseUrl,
    IReadOnlySet<string> Modules);

/// <summary>
/// Ambient impersonation, flowing through async calls. Set by the Telegram webhook for the
/// duration of one message, consulted by <c>CurrentUserService</c> before falling back to HTTP.
/// </summary>
public static class AiImpersonation
{
    private static readonly AsyncLocal<AiImpersonatedUser?> _current = new();

    public static AiImpersonatedUser? Current => _current.Value;

    public static IDisposable Use(AiImpersonatedUser user)
    {
        _current.Value = user;
        return new Scope();
    }

    private sealed class Scope : IDisposable
    {
        public void Dispose() => _current.Value = null;
    }
}
