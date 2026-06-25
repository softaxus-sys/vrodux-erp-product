namespace Softaxis.ProjectManagement.Application.Abstractions;

public interface ICurrentUser
{
    Guid?   Id           { get; }
    string? Username     { get; }
    string? Email        { get; }
    bool    IsSuperAdmin { get; }
    bool    HasPermission(string permissionKey);
}
