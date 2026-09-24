namespace Softaxis.POS.Application.Abstractions;

public interface ICurrentUser
{
    Guid?   Id              { get; }
    string? Username        { get; }
    bool    IsAuthenticated { get; }

    /// <summary>
    /// The tenant's country, straight from the JWT "country" claim. Used to decide which of the
    /// seeded payment methods make sense for this shop - a Pakistani till wants EasyPaisa and
    /// JazzCash, a UAE one wants Apple Pay and Tabby.
    /// </summary>
    string? Country         { get; }
    bool    HasPermission(string permissionKey);
}
