using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.Ecommerce.Application.Abstractions;

namespace Softaxis.Ecommerce.API.Middleware;

public sealed class ShopPreviewService(IHttpContextAccessor accessor) : IShopPreview
{
    public bool CanPreview(Guid storeTenantId)
    {
        var user = accessor.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true) return false;
        // Both must hold: it is THIS workspace's staff, and they may view the store. A signed-in user of another workspace sees nothing.
        if (!Guid.TryParse(user.FindFirstValue("tenant_id"), out var tenant) || tenant != storeTenantId) return false;
        return user.HasClaim("permission", "ecommerce.store.view");
    }
}
