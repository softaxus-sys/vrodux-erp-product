using Softaxis.LeadGen.Application.Abstractions;

namespace Softaxis.LeadGen.Infrastructure.Services;

/// <summary>
/// Who is acting, if anyone. Inside a request this is the signed-in user; inside a background
/// worker there is no request, so both values are null and ledger rows are recorded as "system".
/// </summary>
public interface ICurrentUserAccessor
{
    Guid?   UserId   { get; }
    string? UserName { get; }
}

internal sealed class CurrentUserAccessor(ICurrentUser user) : ICurrentUserAccessor
{
    public Guid?   UserId   => user.Id;
    public string? UserName => user.Name;
}
