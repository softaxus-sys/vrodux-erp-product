using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Integrations.Commands;
using Softaxis.Finance.Application.Integrations.Dtos;
using Softaxis.Finance.Application.Integrations.Queries;

namespace Softaxis.Finance.API.Controllers;

/// <summary>
/// Finance Integration Center: which modules reach the ledger, the accounts they post to, and the
/// queue of documents waiting to be posted.
///
/// <para><c>view</c> reads; <c>edit</c> changes how an integration behaves (mode, accounts,
/// skipping); <c>approve</c> is the one that writes to the ledger — posting, retrying and
/// reversing. Collecting documents into the queue posts nothing by itself, but it does when an
/// integration is set to automatic, so it needs <c>approve</c> too.</para>
/// </summary>
[ApiController]
[Route("api/finance/integrations")]
[Authorize]
public sealed class IntegrationsController(ISender sender) : FinanceControllerBase
{
    private const string View    = "finance.integrations.view";
    private const string Edit    = "finance.integrations.edit";
    private const string Approve = "finance.integrations.approve";
    private const string Submit  = "finance.integrations.submit";
    private const string ApproveHigh = "finance.integrations.approve-high";

    private bool IsSuperAdmin => User.FindFirstValue("is_super_admin") == "true";

    private Guid? UserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    /// <summary>The licensed modules in the token. Null (not restricted) for a super admin or an old token without the claim.</summary>
    private IReadOnlyList<string>? Modules
    {
        get
        {
            if (IsSuperAdmin) return null;
            var raw = User.FindFirstValue("modules");
            return string.IsNullOrWhiteSpace(raw)
                ? null
                : raw.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        }
    }

    private PostingCaller Caller =>
        new(UserId, IsSuperAdmin || User.HasClaim("permission", ApproveHigh), Modules);

    private string? UserName =>
        User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Email);

    [HttpGet]
    [RequirePermission(View)]
    public async Task<IActionResult> Overview([FromQuery] string? module, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetIntegrationOverviewQuery(module, Modules), ct));

    public sealed record SettingRequest(string Mode, string? StartDate, bool AcknowledgeAuto = false);

    /// <summary>
    /// Automatic posting is approving every future document in advance, so choosing it needs the
    /// permission that posts — <c>edit</c> alone could otherwise post without ever holding it.
    /// </summary>
    [HttpPut("{key}/setting")]
    [RequirePermission(Edit)]
    public async Task<IActionResult> UpdateSetting(string key, [FromBody] SettingRequest req, CancellationToken ct)
    {
        if (req.Mode == "auto"
            && User.FindFirstValue("is_super_admin") != "true"
            && !User.HasClaim("permission", Approve))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                Code = "Permission.Denied",
                Description = "Automatic posting needs the permission to post to the ledger, because the documents it posts are not reviewed first.",
            });
        }

        return NoContentOrError(await sender.Send(
            new UpdateIntegrationSettingCommand(key, req.Mode, req.StartDate, UserName, req.AcknowledgeAuto), ct));
    }

    [HttpGet("{key}/auto-readiness")]
    [RequirePermission(View)]
    public async Task<IActionResult> AutoReadiness(string key, [FromQuery] string? startDate, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAutoReadinessQuery(key, startDate), ct));

    public sealed record MappingsRequest(IReadOnlyList<AccountMappingInput> Mappings);

    [HttpPut("{key}/mappings")]
    [RequirePermission(Edit)]
    public async Task<IActionResult> SaveMappings(string key, [FromBody] MappingsRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SaveAccountMappingsCommand(key, req.Mappings ?? []), ct));

    public sealed record SyncRequest(string? IntegrationKey);

    [HttpPost("sync")]
    [RequirePermission(Approve)]
    public async Task<IActionResult> Sync([FromBody] SyncRequest? req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SyncIntegrationsCommand(req?.IntegrationKey, UserName), ct));

    [HttpGet("queue")]
    [RequirePermission(View)]
    public async Task<IActionResult> Queue(
        [FromQuery] string? integrationKey, [FromQuery] string? status, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? module = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetPostingItemsQuery(integrationKey, status, search, page, pageSize, Modules, module), ct));

    [HttpGet("queue/{id:guid}/preview")]
    [RequirePermission(View)]
    public async Task<IActionResult> Preview(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPostingPreviewQuery(id), ct));

    public sealed record CheckRequest(IReadOnlyList<Guid> Ids);

    /// <summary>Checks a selection the way posting would. Writes nothing.</summary>
    [HttpPost("queue/check")]
    [RequirePermission(View)]
    public async Task<IActionResult> Check([FromBody] CheckRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CheckPostingItemsQuery(req.Ids ?? [], Caller), ct));

    public sealed record SubmitRequest(IReadOnlyList<Guid> Ids, bool Withdraw = false);

    /// <summary>
    /// Puts waiting documents forward for approval. The person who prepares documents needs this
    /// and nothing more; whoever holds <c>approve</c> can submit too, for workspaces with one team.
    /// </summary>
    [HttpPost("queue/submit")]
    [RequirePermission(Submit + "," + Approve)]
    public async Task<IActionResult> SubmitItems([FromBody] SubmitRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SubmitItemsCommand(req.Ids ?? [], UserName, UserId, req.Withdraw, Modules), ct));

    public sealed record ApprovalRulesRequest(decimal? ApprovalLimit, bool RequireSeparateApprover);

    /// <summary>Who may approve what. Changing it is itself an approval-level decision.</summary>
    [HttpPut("{key}/approval")]
    [RequirePermission(Approve)]
    public async Task<IActionResult> UpdateApprovalRules(string key, [FromBody] ApprovalRulesRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new UpdateApprovalRulesCommand(key, req.ApprovalLimit, req.RequireSeparateApprover, UserName), ct));

    public sealed record PostRequest(IReadOnlyList<Guid> Ids, decimal? ControlTotal = null);

    [HttpPost("queue/post")]
    [RequirePermission(Approve)]
    public async Task<IActionResult> Post([FromBody] PostRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PostItemsCommand(req.Ids ?? [], UserName, req.ControlTotal, Caller), ct));

    public sealed record RetryRequest(string? IntegrationKey);

    [HttpPost("queue/retry-failed")]
    [RequirePermission(Approve)]
    public async Task<IActionResult> RetryFailed([FromBody] RetryRequest? req, CancellationToken ct) =>
        OkOrError(await sender.Send(new RetryFailedCommand(req?.IntegrationKey, UserName, Caller), ct));

    public sealed record SkipRequest(string? Reason);

    [HttpPost("queue/{id:guid}/skip")]
    [RequirePermission(Edit)]
    public async Task<IActionResult> Skip(Guid id, [FromBody] SkipRequest? req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SkipItemCommand(id, req?.Reason), ct));

    [HttpPost("queue/{id:guid}/requeue")]
    [RequirePermission(Edit)]
    public async Task<IActionResult> Requeue(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new RequeueItemCommand(id), ct));

    public sealed record ReverseRequest(string? Reason);

    [HttpPost("queue/{id:guid}/reverse")]
    [RequirePermission(Approve)]
    public async Task<IActionResult> Reverse(Guid id, [FromBody] ReverseRequest? req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new ReverseItemCommand(id, req?.Reason, UserName, Caller), ct));
}
