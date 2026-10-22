using System.Security.Cryptography;
using System.Text;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Softaxis.Messaging.API.Authorization;
using Softaxis.Messaging.API.Controllers.Common;
using Softaxis.Messaging.Application.WhatsApp;

namespace Softaxis.Messaging.API.Controllers;

/// <summary>WhatsApp for the signed-in workspace: connection, templates, sending, inbox, auto replies.</summary>
[Authorize]
[Route("api/messaging/whatsapp")]
public sealed class WhatsAppController(ISender sender) : MessagingControllerBase
{
    // ── Connection + auto replies ────────────────────────────────────────────
    [HttpGet("connection")]
    [RequirePermission("messaging.settings.view", "messaging.inbox.send")]
    public async Task<IActionResult> GetConnection(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWaConnectionQuery(), ct));

    [HttpPost("connection")]
    [RequirePermission("messaging.settings.edit")]
    public async Task<IActionResult> Connect([FromBody] ConnectWaCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpDelete("connection")]
    [RequirePermission("messaging.settings.edit")]
    public async Task<IActionResult> Disconnect(CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DisconnectWaCommand(), ct));

    /// <summary>This workspace's own Meta app secret, for verifying incoming deliveries. Blank removes it.</summary>
    [HttpPut("app-secret")]
    [RequirePermission("messaging.settings.edit")]
    public async Task<IActionResult> SetAppSecret([FromBody] SetWaAppSecretCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPut("auto-replies")]
    [RequirePermission("messaging.settings.edit")]
    public async Task<IActionResult> UpdateAutoReplies([FromBody] UpdateWaAutoRepliesCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpGet("keyword-rules")]
    [RequirePermission("messaging.settings.view")]
    public async Task<IActionResult> GetRules(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWaKeywordRulesQuery(), ct));

    [HttpPost("keyword-rules")]
    [RequirePermission("messaging.settings.edit")]
    public async Task<IActionResult> SaveRule([FromBody] SaveWaKeywordRuleCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpDelete("keyword-rules/{id:guid}")]
    [RequirePermission("messaging.settings.edit")]
    public async Task<IActionResult> DeleteRule(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteWaKeywordRuleCommand(id), ct));

    [HttpGet("automations")]
    [RequirePermission("messaging.settings.view")]
    public async Task<IActionResult> GetAutomations(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWaAutomationsQuery(), ct));

    [HttpPut("automations")]
    [RequirePermission("messaging.settings.edit")]
    public async Task<IActionResult> SaveAutomation([FromBody] SaveWaAutomationCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    // ── Templates ────────────────────────────────────────────────────────────
    /// <summary>Senders need the approved list too, so sending alone is enough to read it.</summary>
    [HttpGet("templates")]
    [RequirePermission("messaging.templates.view", "messaging.inbox.send")]
    public async Task<IActionResult> GetTemplates([FromQuery] bool approvedOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWaTemplatesQuery(approvedOnly), ct));

    [HttpPost("templates/sync")]
    [RequirePermission("messaging.templates.view")]
    public async Task<IActionResult> SyncTemplates(CancellationToken ct) =>
        OkOrError(await sender.Send(new SyncWaTemplatesCommand(), ct));

    [HttpPost("templates")]
    [RequirePermission("messaging.templates.create")]
    public async Task<IActionResult> CreateTemplate([FromBody] CreateWaTemplateCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    // ── Sending + inbox ──────────────────────────────────────────────────────
    [HttpPost("send")]
    [RequirePermission("messaging.inbox.send")]
    public async Task<IActionResult> Send([FromBody] SendWaMessageCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpGet("conversations")]
    [RequirePermission("messaging.inbox.view")]
    public async Task<IActionResult> GetConversations([FromQuery] string? search, [FromQuery] bool unreadOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWaConversationsQuery(search, unreadOnly), ct));

    [HttpGet("conversations/{id:guid}/messages")]
    [RequirePermission("messaging.inbox.view")]
    public async Task<IActionResult> GetMessages(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWaMessagesQuery(id), ct));

    [HttpPost("conversations/{id:guid}/read")]
    [RequirePermission("messaging.inbox.view")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new MarkWaConversationReadCommand(id), ct));

    /// <summary>A record's WhatsApp history, for the drawer of a lead, prospect, account…</summary>
    [HttpGet("thread")]
    [RequirePermission("messaging.inbox.view", "messaging.inbox.send")]
    public async Task<IActionResult> GetThread([FromQuery] string relatedType, [FromQuery] Guid relatedId,
        [FromQuery] string? phone, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWaRecordThreadQuery(relatedType, relatedId, phone), ct));
}

/// <summary>
/// Meta's webhook. One URL for every workspace; anonymous. The verify token says which workspace is
/// subscribing, and each delivery is checked against the app secret of the workspace that owns the
/// number (see <c>ProcessWaWebhookHandler</c>), else the shared Vrodux app secret.
/// </summary>
[AllowAnonymous]
[Route("api/webhooks/whatsapp")]
public sealed class WhatsAppWebhookController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Verify([FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? token, [FromQuery(Name = "hub.challenge")] string? challenge,
        CancellationToken ct)
    {
        if (mode != "subscribe" || string.IsNullOrEmpty(token)) return StatusCode(403);
        var ok = await sender.Send(new VerifyWaWebhookTokenQuery(token), ct);
        return ok.IsSuccess && ok.Value ? Content(challenge ?? "", "text/plain") : StatusCode(403);
    }

    [HttpPost]
    public async Task<IActionResult> Receive(CancellationToken ct)
    {
        // Signed over the exact bytes Meta sent, so the handler hashes those, not a re-encoded string.
        using var buffer = new MemoryStream();
        await Request.Body.CopyToAsync(buffer, ct);

        var result = await sender.Send(
            new ProcessWaWebhookCommand(buffer.ToArray(), Request.Headers["X-Hub-Signature-256"].ToString()), ct);
        return result.IsSuccess ? Ok() : StatusCode(401);
    }
}
