namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>
/// The authenticated caller, resolved from JWT claims by the API layer. The AI orchestrator
/// uses this to (a) scope tools to the caller's permissions and (b) personalise the assistant.
/// </summary>
public interface ICurrentUser
{
    Guid?   Id            { get; }
    string? Username      { get; }
    string? Email         { get; }
    bool    IsSuperAdmin  { get; }

    /// <summary>True if the caller holds the given permission claim (e.g. "crm.leads.view").</summary>
    bool HasPermission(string permissionKey);

    /// <summary>The raw bearer token of the current request, so tools can call back to the gateway as this user.</summary>
    string? BearerToken { get; }

    /// <summary>Scheme+host of the current request (e.g. "https://erp.vrodux.com"), used as the tool call base URL.</summary>
    string? RequestBaseUrl { get; }
}
