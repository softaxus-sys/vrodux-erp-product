namespace Softaxis.Trade.Application.Abstractions;

/// <summary>The signed-in user, read from the request's token.</summary>
public interface ICurrentUser
{
    Guid?   Id           { get; }
    string? Name         { get; }
    bool    IsSuperAdmin { get; }
    bool    HasPermission(string permissionKey);
}
