using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

namespace Softaxis.ApiGateway.Sync;

/// <summary>
/// On a branch server, refuses edits to the setup data that head office owns.
///
/// <para>
/// Every table has exactly one owner (docs/branch-server-design.md). Branches, users, roles, settings, the
/// menu and the other setup data belong to head office and flow DOWN; a change made here is never sent up and
/// is overwritten by the next sync, so letting it through only leaves the branch quietly different from head
/// office. Orders, payments, shifts and the kitchen are the branch's own and are untouched.
/// </para>
/// Reads are always allowed. Does nothing on the cloud or on a single-store install.
/// </summary>
public sealed class BranchHeadOfficeOnlyMiddleware(RequestDelegate next, IOptions<BranchSyncOptions> options)
{
    private static readonly string[] HeadOfficePrefixes =
    [
        // Identity
        "/api/branches", "/api/users", "/api/roles", "/api/permissions", "/api/teams",
        "/api/app-settings", "/api/tenant-settings", "/api/license", "/api/billing", "/api/admin",
        // Restaurant setup
        "/api/restaurant/menu", "/api/restaurant/modifier-groups", "/api/restaurant/combos",
        "/api/restaurant/happy-hour-rules", "/api/restaurant/delivery-zones", "/api/restaurant/kitchen-stations",
        "/api/restaurant/floors", "/api/restaurant/tax", "/api/restaurant/user-branches",
        // POS setup
        "/api/tax-rates", "/api/payment-methods", "/api/payment-terms", "/api/customer-groups",
        "/api/vouchers", "/api/currencies", "/api/pos-settings",
    ];

    public async Task InvokeAsync(HttpContext ctx)
    {
        if (options.Value.IsBranch && IsWrite(ctx.Request.Method) && IsHeadOfficeOnly(ctx.Request.Path))
        {
            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            await ctx.Response.WriteAsJsonAsync(new
            {
                success = false,
                errorCode = "BRANCH_HEAD_OFFICE_ONLY",
                message = "This is managed at head office (erp.vrodux.com). Make the change there; it will appear here after the next sync.",
            });
            return;
        }
        await next(ctx);
    }

    private static bool IsWrite(string method) =>
        HttpMethods.IsPost(method) || HttpMethods.IsPut(method) || HttpMethods.IsPatch(method) || HttpMethods.IsDelete(method);

    private static bool IsHeadOfficeOnly(PathString path)
    {
        foreach (var prefix in HeadOfficePrefixes)
            if (path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }
}
