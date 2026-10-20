using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.LeadGen.API.Authorization;
using Softaxis.LeadGen.API.Controllers.Common;
using Softaxis.LeadGen.Application.Credits;
using Softaxis.LeadGen.Application.Prospects;
using Softaxis.LeadGen.Application.Reports;
using Softaxis.LeadGen.Application.Searches;
using Softaxis.LeadGen.Application.Setup;

namespace Softaxis.LeadGen.API.Controllers;

// Every action below names the permission it needs, and permissions are granted to roles by an
// administrator — there is no hardcoded "admins only" anywhere. The role a person holds decides
// whether they can run a search, spend credits, connect a mailbox or send mail.

[Route("api/leadgen")][Authorize]
public sealed class SetupController(ISender sender) : LeadGenControllerBase
{
    [HttpGet("meta")]
    [RequirePermission("leadgen.searches.view", "leadgen.prospects.view", "leadgen.credits.view", "leadgen.mailboxes.view",
        "leadgen.campaigns.view", "leadgen.inbox.view", "leadgen.settings.view", "leadgen.reports.view")]
    public async Task<IActionResult> Meta(CancellationToken ct) => OkOrError(await sender.Send(new GetMetaQuery(), ct));

    [HttpGet("profile")]
    [RequirePermission("leadgen.settings.view", "leadgen.searches.create", "leadgen.campaigns.create")]
    public async Task<IActionResult> Profile(CancellationToken ct) => OkOrError(await sender.Send(new GetProfileQuery(), ct));

    [HttpPut("profile")]
    [RequirePermission("leadgen.settings.edit")]
    public async Task<IActionResult> UpdateProfile([FromBody] ProfileInput input, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateProfileCommand(input), ct));

    // ── Do not contact ───────────────────────────────────────────────────────────────────────

    public sealed record SuppressionRequest(string Kind, string Value, string? Reason);
    public sealed record SuppressionImportRequest(IReadOnlyList<string> Values);

    [HttpGet("suppressions")]
    [RequirePermission("leadgen.settings.view")]
    public async Task<IActionResult> Suppressions([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetSuppressionQuery(search, page, pageSize), ct));

    [HttpPost("suppressions")]
    [RequirePermission("leadgen.settings.edit")]
    public async Task<IActionResult> AddSuppression([FromBody] SuppressionRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddSuppressionCommand(r.Kind, r.Value, r.Reason), ct));

    [HttpPost("suppressions/import")]
    [RequirePermission("leadgen.settings.edit")]
    public async Task<IActionResult> ImportSuppressions([FromBody] SuppressionImportRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new ImportSuppressionCommand(r.Values), ct));

    [HttpDelete("suppressions/{id:guid}")]
    [RequirePermission("leadgen.settings.edit")]
    public async Task<IActionResult> RemoveSuppression(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new RemoveSuppressionCommand(id), ct));

    // ── Dashboard ────────────────────────────────────────────────────────────────────────────

    [HttpGet("dashboard")]
    [RequirePermission("leadgen.reports.view")]
    public async Task<IActionResult> Dashboard([FromQuery] int days = 30, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetDashboardQuery(days), ct));
}

[Route("api/leadgen/searches")][Authorize]
public sealed class SearchesController(ISender sender) : LeadGenControllerBase
{
    [HttpGet]
    [RequirePermission("leadgen.searches.view")]
    public async Task<IActionResult> List(CancellationToken ct) => OkOrError(await sender.Send(new GetSearchesQuery(), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("leadgen.searches.view")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetSearchByIdQuery(id), ct));

    [HttpPost("estimate")]
    [RequirePermission("leadgen.searches.create")]
    public async Task<IActionResult> Estimate([FromBody] SearchInput input, CancellationToken ct) =>
        OkOrError(await sender.Send(new EstimateSearchQuery(input), ct));

    [HttpPost]
    [RequirePermission("leadgen.searches.create")]
    public async Task<IActionResult> Create([FromBody] SearchInput input, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateSearchCommand(input), ct));

    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("leadgen.searches.create")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new CancelSearchCommand(id), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("leadgen.searches.delete")]
    public async Task<IActionResult> Delete(Guid id, [FromQuery] bool deleteUnrevealed = true, CancellationToken ct = default) =>
        NoContentOrError(await sender.Send(new DeleteSearchCommand(id, deleteUnrevealed), ct));
}

[Route("api/leadgen/prospects")][Authorize]
public sealed class ProspectsController(ISender sender) : LeadGenControllerBase
{
    public sealed record UpdateRequest(string? Status, string? Notes, Guid? OwnerUserId, string? OwnerName, bool ClearOwner);
    public sealed record IdsRequest(IReadOnlyList<Guid> Ids);
    public sealed record BulkRequest(IReadOnlyList<Guid> Ids, string Action, string? Status, Guid? OwnerUserId, string? OwnerName);
    public sealed record ContactRequest(string FullName, string? Title, string? Email, string? Phone);

    [HttpGet]
    [RequirePermission("leadgen.prospects.view")]
    public async Task<IActionResult> List(
        [FromQuery] string? search, [FromQuery] Guid? searchId, [FromQuery] string? status, [FromQuery] bool? revealed,
        [FromQuery] int? minQuality, [FromQuery] int? minFit, [FromQuery] string? region, [FromQuery] string? category,
        [FromQuery] bool? hasEmail, [FromQuery] Guid? ownerId, [FromQuery] bool? inCrm, [FromQuery] string? sort,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetProspectsQuery(
            new ProspectFilter(search, searchId, status, revealed, minQuality, minFit, region, category, hasEmail, ownerId, inCrm, sort),
            page, pageSize), ct));

    [HttpGet("stats")]
    [RequirePermission("leadgen.prospects.view")]
    public async Task<IActionResult> Stats([FromQuery] Guid? searchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetProspectStatsQuery(searchId), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("leadgen.prospects.view")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetProspectByIdQuery(id), ct));

    [HttpPost]
    [RequirePermission("leadgen.prospects.create")]
    public async Task<IActionResult> Create([FromBody] CreateProspectInput input, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateProspectCommand(input), ct));

    [HttpPatch("{id:guid}")]
    [RequirePermission("leadgen.prospects.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateProspectCommand(id, r.Status, r.Notes, r.OwnerUserId, r.OwnerName, r.ClearOwner), ct));

    [HttpPost("bulk")]
    [RequirePermission("leadgen.prospects.edit")]
    public async Task<IActionResult> Bulk([FromBody] BulkRequest r, CancellationToken ct)
    {
        // Deleting is a separate permission from editing, so it is checked here rather than assumed.
        if (r.Action == "delete" && !User.HasClaim("permission", "leadgen.prospects.delete") && User.FindFirst("is_super_admin")?.Value != "true")
            return StatusCode(403, new { Code = "Permission.Denied", Description = "Missing permission: leadgen.prospects.delete" });
        return OkOrError(await sender.Send(new BulkProspectsCommand(r.Ids, r.Action, r.Status, r.OwnerUserId, r.OwnerName), ct));
    }

    /// <summary>Spends credits. Its own permission, so an administrator decides exactly who may.</summary>
    [HttpPost("reveal")]
    [RequirePermission("leadgen.prospects.reveal")]
    public async Task<IActionResult> Reveal([FromBody] IdsRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new RevealProspectsCommand(r.Ids), ct));

    [HttpPost("import-to-crm")]
    [RequirePermission("leadgen.prospects.import")]
    public async Task<IActionResult> ImportToCrm([FromBody] IdsRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new ImportToCrmCommand(r.Ids), ct));

    [HttpPost("{id:guid}/contacts")]
    [RequirePermission("leadgen.prospects.edit")]
    public async Task<IActionResult> AddContact(Guid id, [FromBody] ContactRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddContactCommand(id, r.FullName, r.Title, r.Email, r.Phone), ct));

    [HttpDelete("{id:guid}/contacts/{contactId:guid}")]
    [RequirePermission("leadgen.prospects.edit")]
    public async Task<IActionResult> DeleteContact(Guid id, Guid contactId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteContactCommand(id, contactId), ct));
}

[Route("api/leadgen/credits")][Authorize]
public sealed class CreditsController(ISender sender) : LeadGenControllerBase
{
    public sealed record CheckoutRequest(Guid PackId, string Provider, string ReturnPath);
    public sealed record ConfirmRequest(string OrderId);
    public sealed record AlertRequest(long? Threshold);

    /// <summary>The balance is shown in the header of every Lead Generation screen, so any view key may read it.</summary>
    [HttpGet("wallet")]
    [RequirePermission("leadgen.searches.view", "leadgen.prospects.view", "leadgen.credits.view", "leadgen.campaigns.view", "leadgen.reports.view")]
    public async Task<IActionResult> Wallet(CancellationToken ct) => OkOrError(await sender.Send(new GetWalletQuery(), ct));

    [HttpGet("ledger")]
    [RequirePermission("leadgen.credits.view")]
    public async Task<IActionResult> Ledger([FromQuery] string? type, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetLedgerQuery(type, page, pageSize), ct));

    [HttpGet("packs")]
    [RequirePermission("leadgen.credits.view")]
    public async Task<IActionResult> Packs(CancellationToken ct) => OkOrError(await sender.Send(new GetPacksQuery(), ct));

    [HttpGet("purchases")]
    [RequirePermission("leadgen.credits.view")]
    public async Task<IActionResult> Purchases(CancellationToken ct) => OkOrError(await sender.Send(new GetPurchasesQuery(), ct));

    [HttpGet("payment-options")]
    [RequirePermission("leadgen.credits.view")]
    public async Task<IActionResult> PaymentOptions(CancellationToken ct) => OkOrError(await sender.Send(new GetPaymentOptionsQuery(), ct));

    /// <summary>Buying credits spends the company's money, so it is a distinct permission from simply seeing the balance.</summary>
    [HttpPost("checkout")]
    [RequirePermission("leadgen.credits.create")]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new StartCheckoutCommand(r.PackId, r.Provider, r.ReturnPath), ct));

    [HttpPost("paypal/confirm")]
    [RequirePermission("leadgen.credits.create")]
    public async Task<IActionResult> ConfirmPayPal([FromBody] ConfirmRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new ConfirmPayPalCommand(r.OrderId), ct));

    [HttpPut("low-balance-alert")]
    [RequirePermission("leadgen.credits.edit")]
    public async Task<IActionResult> LowBalance([FromBody] AlertRequest r, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetLowBalanceAlertCommand(r.Threshold), ct));
}
