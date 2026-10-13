using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.Calendar.Application.Abstractions;

namespace Softaxis.Calendar.API.Middleware;

public sealed class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public Guid? Id
    {
        get
        {
            var val = Principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? Principal?.FindFirstValue("sub");
            return Guid.TryParse(val, out var id) ? id : null;
        }
    }

    // JwtTokenService emits the username under a plain "username" claim.
    public string? Username => Principal?.FindFirstValue("username");
    public string? Email => Principal?.FindFirstValue(ClaimTypes.Email) ?? Principal?.FindFirstValue("email");
    public bool IsSuperAdmin => Principal?.FindFirstValue("is_super_admin") == "true";

    public Guid? TenantId =>
        Guid.TryParse(Principal?.FindFirstValue("tenant_id"), out var id) ? id : null;
}
