using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.AppSettings.Commands.UpsertAllSettings;
using Softaxis.Identity.Application.AppSettings.Commands.UpsertSettingsCategory;
using Softaxis.Identity.Application.AppSettings.Queries.GetAllSettings;
using Softaxis.Identity.Application.AppSettings.Queries.GetSettingsCategory;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Application settings store — key-value pairs grouped by category.
///
/// Scoping rules:
///   • "appearance"                           → per-user  (UserId = caller's sub claim)
///   • "company","regional","notifications",  → company-wide (UserId = null)
///     "security","modules"
///
/// Endpoints:
///   GET  /api/app-settings               → all settings (company-wide + caller's user settings)
///   GET  /api/app-settings/{category}    → single category
///   PUT  /api/app-settings/{category}    → upsert one category
///   PUT  /api/app-settings               → upsert all categories
/// </summary>
[Authorize]
[ApiController]
[Route("api/app-settings")]
[Produces("application/json")]
[Tags("AppSettings")]
public sealed class AppSettingsController(ISender sender) : BaseApiController(sender)
{
    // ── Caller identity ───────────────────────────────────────────────────────

    private string CurrentUserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ??
        User.FindFirstValue(JwtRegisteredClaimNames.Sub) ??
        User.FindFirstValue(ClaimTypes.Email) ??
        "anonymous";

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ??
        User.FindFirstValue(JwtRegisteredClaimNames.Sub) ??
        "system";

    // ── GET /api/app-settings ─────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        HandleResult(await Sender.Send(new GetAllSettingsQuery(CurrentUserId), ct));

    // ── GET /api/app-settings/{category} ─────────────────────────────────────
    [HttpGet("{category}")]
    public async Task<IActionResult> GetCategory(string category, CancellationToken ct) =>
        HandleResult(await Sender.Send(new GetSettingsCategoryQuery(category, CurrentUserId), ct));

    // ── PUT /api/app-settings/{category} ─────────────────────────────────────
    [HttpPut("{category}")]
    public async Task<IActionResult> UpsertCategory(
        string category,
        [FromBody] Dictionary<string, string> keyValues,
        CancellationToken ct) =>
        HandleResult(await Sender.Send(
            new UpsertSettingsCategoryCommand(category, keyValues, CurrentUserId, CurrentUserEmail), ct));

    // ── PUT /api/app-settings ─────────────────────────────────────────────────
    [HttpPut]
    public async Task<IActionResult> UpsertAll(
        [FromBody] Dictionary<string, Dictionary<string, string>> categoryMap,
        CancellationToken ct) =>
        HandleResult(await Sender.Send(
            new UpsertAllSettingsCommand(categoryMap, CurrentUserId, CurrentUserEmail), ct));
}
