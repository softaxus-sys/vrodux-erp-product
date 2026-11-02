using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.Ecommerce.Application.Abstractions;

namespace Softaxis.Ecommerce.API.Middleware;

/// <summary>Reads the signed-in user from the request's JWT claims, like the other services.</summary>
public sealed class CurrentStaffService(IHttpContextAccessor accessor) : ICurrentStaff
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public Guid? Id =>
        Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? Principal?.FindFirstValue("sub"), out var id) ? id : null;

    public string Name
    {
        get
        {
            var n = Principal?.FindFirstValue(ClaimTypes.Name) ?? Principal?.FindFirstValue("name") ?? Principal?.FindFirstValue(ClaimTypes.Email);
            return string.IsNullOrWhiteSpace(n) ? "Staff" : n;
        }
    }
}
