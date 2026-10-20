using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Softaxis.LeadGen.API.Authorization;
using Softaxis.LeadGen.API.Controllers.Common;
using Softaxis.LeadGen.API.Extensions;
using Softaxis.LeadGen.Application.Campaigns;
using Softaxis.LeadGen.Application.Inbox;
using Softaxis.LeadGen.Application.Mailboxes;
using Softaxis.LeadGen.Infrastructure.Options;
using Microsoft.AspNetCore.RateLimiting;

namespace Softaxis.LeadGen.API.Controllers;

[Route("api/leadgen/mailboxes")][Authorize]
public sealed class MailboxesController(ISender sender, IOptions<LeadGenOptions> options, IConfiguration config) : LeadGenControllerBase
{
    public sealed record StartOAuthRequest(string ReturnPath);
    public sealed record UpdateRequest(int DailyLimit, string? SignatureText, string? DisplayName);
    public sealed record TestRequest(string To);

    [HttpGet]
    [RequirePermission("leadgen.mailboxes.view", "leadgen.campaigns.view", "leadgen.campaigns.create", "leadgen.inbox.view")]
    public async Task<IActionResult> List(CancellationToken ct) => OkOrError(await sender.Send(new GetMailboxesQuery(), ct));

    [HttpGet("providers")]
    [RequirePermission("leadgen.mailboxes.view", "leadgen.mailboxes.create")]
    public async Task<IActionResult> Providers(CancellationToken ct) => OkOrError(await sender.Send(new GetMailboxProvidersQuery(), ct));

    [HttpPost("imap")]
    [RequirePermission("leadgen.mailboxes.create")]
    public async Task<IActionResult> ConnectImap([FromBody] ConnectImapInput input, CancellationToken ct) =>
        OkOrError(await sender.Send(new ConnectImapCommand(input), ct));

    [HttpPost("oauth/{provider}/start")]
    [RequirePermission("leadgen.mailboxes.create")]
    public async Task<IActionResult> StartOAuth(string provider, [FromBody] StartOAuthRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new StartMailboxOAuthCommand(provider.ToLowerInvariant(), CallbackUri(), r.ReturnPath), ct));

    /// <summary>
    /// Google / Microsoft redirect the browser here with no token, so it is anonymous; who and where are
    /// carried in the sealed, time-limited state created when the sign-in started.
    /// </summary>
    [HttpGet("oauth/callback")]
    [AllowAnonymous]
    [EnableRateLimiting(LeadGenRateLimitPolicies.Public)]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state,
        [FromQuery(Name = "error")] string? error, [FromQuery(Name = "error_description")] string? description, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(state)) return Redirect(Back("/lead-generation/mailboxes", false, "The sign-in was cancelled."));
        if (!string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code))
            return Redirect(Back("/lead-generation/mailboxes", false, error == "access_denied" ? "You cancelled the sign-in." : "The sign-in did not complete."));

        var result = await sender.Send(new MailboxOAuthCallbackCommand(code, state, CallbackUri()), ct);
        if (!result.IsSuccess) return Redirect(Back("/lead-generation/mailboxes", false, "The sign-in did not complete."));
        var r = result.Value;
        return Redirect(Back(r.ReturnPath, r.Connected, r.Error));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("leadgen.mailboxes.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateMailboxCommand(id, r.DailyLimit, r.SignatureText, r.DisplayName), ct));

    [HttpPost("{id:guid}/pause")]
    [RequirePermission("leadgen.mailboxes.edit")]
    public async Task<IActionResult> Pause(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new PauseMailboxCommand(id), ct));

    [HttpPost("{id:guid}/resume")]
    [RequirePermission("leadgen.mailboxes.edit")]
    public async Task<IActionResult> Resume(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new ResumeMailboxCommand(id), ct));

    [HttpPost("{id:guid}/test")]
    [RequirePermission("leadgen.mailboxes.edit")]
    public async Task<IActionResult> Test(Guid id, [FromBody] TestRequest r, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SendTestEmailCommand(id, r.To), ct));

    [HttpPost("{id:guid}/sync")]
    [RequirePermission("leadgen.mailboxes.edit", "leadgen.inbox.edit")]
    public async Task<IActionResult> Sync(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new SyncMailboxNowCommand(id), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("leadgen.mailboxes.delete")]
    public async Task<IActionResult> Disconnect(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DisconnectMailboxCommand(id), ct));

    private string CallbackUri() => $"{Request.Scheme}://{Request.Host}/api/leadgen/mailboxes/oauth/callback";

    private string Back(string path, bool ok, string? message)
    {
        var baseUrl = options.Value.PublicBaseUrl
            ?? config["Integrations:FrontendBaseUrl"]
            ?? config.GetSection("AllowedOrigins").Get<string[]>()?.FirstOrDefault()
            ?? "http://localhost:3000";
        var sep = path.Contains('?') ? "&" : "?";
        var url = $"{baseUrl.TrimEnd('/')}{path}{sep}mailbox={(ok ? "connected" : "error")}";
        return string.IsNullOrEmpty(message) ? url : $"{url}&message={Uri.EscapeDataString(message)}";
    }
}

[Route("api/leadgen/campaigns")][Authorize]
public sealed class CampaignsController(ISender sender) : LeadGenControllerBase
{
    public sealed record RecipientsRequest(IReadOnlyList<Guid> ProspectIds);
    public sealed record RemoveRequest(IReadOnlyList<Guid> RecipientIds);
    public sealed record TestRequest(int Step, string To);

    [HttpGet]
    [RequirePermission("leadgen.campaigns.view")]
    public async Task<IActionResult> List(CancellationToken ct) => OkOrError(await sender.Send(new GetCampaignsQuery(), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("leadgen.campaigns.view")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetCampaignByIdQuery(id), ct));

    [HttpGet("{id:guid}/recipients")]
    [RequirePermission("leadgen.campaigns.view")]
    public async Task<IActionResult> Recipients(Guid id, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetRecipientsQuery(id, status, page, pageSize), ct));

    [HttpGet("{id:guid}/preview")]
    [RequirePermission("leadgen.campaigns.view")]
    public async Task<IActionResult> Preview(Guid id, [FromQuery] int step = 1, [FromQuery] Guid? prospectId = null, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new PreviewEmailQuery(id, step, prospectId), ct));

    [HttpPost]
    [RequirePermission("leadgen.campaigns.create")]
    public async Task<IActionResult> Create([FromBody] CampaignInput input, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateCampaignCommand(input), ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("leadgen.campaigns.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CampaignInput input, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateCampaignCommand(id, input), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("leadgen.campaigns.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteCampaignCommand(id), ct));

    [HttpPost("{id:guid}/recipients")]
    [RequirePermission("leadgen.campaigns.edit")]
    public async Task<IActionResult> AddRecipients(Guid id, [FromBody] RecipientsRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddRecipientsCommand(id, r.ProspectIds), ct));

    [HttpPost("{id:guid}/recipients/remove")]
    [RequirePermission("leadgen.campaigns.edit")]
    public async Task<IActionResult> RemoveRecipients(Guid id, [FromBody] RemoveRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new RemoveRecipientsCommand(id, r.RecipientIds), ct));

    /// <summary>The moment mail starts leaving the building — its own permission, "send".</summary>
    [HttpPost("{id:guid}/start")]
    [RequirePermission("leadgen.campaigns.send")]
    public async Task<IActionResult> Start(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new StartCampaignCommand(id), ct));

    /// <summary>Stopping is always allowed to anyone who can send or edit: halting mail must never be harder than starting it.</summary>
    [HttpPost("{id:guid}/pause")]
    [RequirePermission("leadgen.campaigns.send", "leadgen.campaigns.edit")]
    public async Task<IActionResult> Pause(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new PauseCampaignCommand(id), ct));

    [HttpPost("{id:guid}/stop")]
    [RequirePermission("leadgen.campaigns.send", "leadgen.campaigns.edit")]
    public async Task<IActionResult> Stop(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new StopCampaignCommand(id), ct));

    [HttpPost("{id:guid}/test")]
    [RequirePermission("leadgen.campaigns.edit", "leadgen.campaigns.send")]
    public async Task<IActionResult> Test(Guid id, [FromBody] TestRequest r, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SendCampaignTestCommand(id, r.Step, r.To), ct));
}

[Route("api/leadgen/inbox")][Authorize]
public sealed class InboxController(ISender sender) : LeadGenControllerBase
{
    public sealed record ReplyRequest(string Body);
    public sealed record UpdateRequest(string? Classification, Guid? AssignedUserId, string? AssignedName, bool ClearAssignee, bool? Archived, bool? MarkRead);

    [HttpGet("threads")]
    [RequirePermission("leadgen.inbox.view")]
    public async Task<IActionResult> Threads(
        [FromQuery] Guid? mailboxId, [FromQuery] string? classification, [FromQuery] bool? unread, [FromQuery] bool? mine,
        [FromQuery] bool? archived, [FromQuery] bool? repliesOnly, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 40, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetThreadsQuery(new ThreadFilter(mailboxId, classification, unread, mine, archived ?? false, repliesOnly, search), page, pageSize), ct));

    [HttpGet("threads/{id:guid}")]
    [RequirePermission("leadgen.inbox.view")]
    public async Task<IActionResult> Thread(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetThreadQuery(id), ct));

    [HttpGet("counts")]
    [RequirePermission("leadgen.inbox.view")]
    public async Task<IActionResult> Counts(CancellationToken ct) => OkOrError(await sender.Send(new GetInboxCountsQuery(), ct));

    [HttpPost("threads/{id:guid}/reply")]
    [RequirePermission("leadgen.inbox.send")]
    public async Task<IActionResult> Reply(Guid id, [FromBody] ReplyRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new ReplyCommand(id, r.Body), ct));

    [HttpPatch("threads/{id:guid}")]
    [RequirePermission("leadgen.inbox.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateThreadCommand(id, r.Classification, r.AssignedUserId, r.AssignedName, r.ClearAssignee, r.Archived, r.MarkRead), ct));
}
