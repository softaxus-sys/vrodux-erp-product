namespace Softaxis.POS.Application.Abstractions;

public interface ICurrentUser
{
    Guid?   Id              { get; }
    string? Username        { get; }
    bool    IsAuthenticated { get; }
    bool    HasPermission(string permissionKey);
}
