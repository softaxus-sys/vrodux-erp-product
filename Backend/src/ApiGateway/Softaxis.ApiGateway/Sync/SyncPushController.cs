using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.BuildingBlocks.Application.Sync;
using Softaxis.BuildingBlocks.Infrastructure.Sync;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.ApiGateway.Sync;

/// <summary>
/// Receives the nightly push from an on-premises installation into its cloud mirror.
///
/// <para>
/// <b>Authenticated by the installation's license key, not by a user session.</b> There is no user
/// behind a nightly job, and each box already holds an RSA-signed key carrying its tenant id and
/// expiry. Reusing it avoids inventing a second credential and a second place to rotate it - and it
/// means a box whose license has expired also stops syncing, which is correct.
/// </para>
///
/// <para>
/// <c>/api/sync/</c> is exempt from <c>SubscriptionEnforcementMiddleware</c> (Phase 1): the endpoint
/// must not be blocked by the situation it exists to resolve, and the mirror's own read-only guard
/// would otherwise refuse the very writes the mirror is made of.
/// </para>
///
/// <para>See <c>docs/on-premises-cloud-mirror.md</c> §6 and §7.</para>
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/sync")]
public sealed class SyncPushController(
    ILicenseService              licenses,
    ITenantRepository            tenants,
    SyncReceiveStore             store,
    SyncSchemaReader             schemaReader,
    ILogger<SyncPushController>  logger) : ControllerBase
{
    /// <summary>Applies one table's batch. Idempotent on <c>BatchId</c>.</summary>
    [HttpPost("push")]
    public async Task<IActionResult> Push([FromBody] SyncPushRequest request, CancellationToken ct)
    {
        var auth = await AuthenticateAsync(request, ct);
        if (auth is not null) return auth;

        var catalogue = SyncTableCatalog.Build(
            await schemaReader.ReadTablesAsync(
                SyncTableCatalog.BusinessSchemas.Append("identity").ToArray(), ct));

        await store.EnsureCreatedAsync(ct);
        var result = await store.ApplyAsync(request, catalogue, ct);

        if (result.Rejected > 0)
        {
            // 200 with the counts rather than an error status: the sender needs the per-row detail
            // to decide whether to advance its watermark, and a bare 4xx would throw that away.
            logger.LogWarning(
                "Sync: {Table} batch {BatchId} from {TenantId} - {Rejected} row(s) rejected. {Errors}",
                request.TableName, request.BatchId, request.TenantId, result.Rejected,
                string.Join(" | ", result.Errors.Take(3)));
        }

        return Ok(result);
    }

    /// <summary>
    /// Reports whether a batch already landed. The sender calls this after a timeout, where it
    /// cannot tell a lost request from a lost response - without it, the only options are to skip a
    /// batch that never arrived or to resend one that did.
    /// </summary>
    [HttpGet("batches/{batchId:guid}")]
    public async Task<IActionResult> BatchStatus(
        Guid batchId, [FromQuery] Guid tenantId, [FromQuery] string licenseKey, CancellationToken ct)
    {
        var auth = await AuthenticateAsync(
            new SyncPushRequest(tenantId, licenseKey, batchId, string.Empty, 0, 0, []), ct,
            checkTable: false);
        if (auth is not null) return auth;

        await store.EnsureCreatedAsync(ct);
        return Ok(new { batchId, applied = await store.WasBatchAppliedAsync(batchId, tenantId, ct) });
    }

    // ── Authentication ────────────────────────────────────────────────────────

    /// <summary>
    /// Returns an error result when the caller must be refused, or null when it may proceed. Three
    /// things have to hold, and each is checked separately so the log says which one failed.
    /// </summary>
    private async Task<IActionResult?> AuthenticateAsync(
        SyncPushRequest request, CancellationToken ct, bool checkTable = true)
    {
        if (string.IsNullOrWhiteSpace(request.LicenseKey))
            return Unauthorized(new { error = "A license key is required." });

        // 1. The key is genuinely ours and has not expired. Signature-verified, so a tampered
        //    payload - including a swapped tenant id - fails here.
        var payload = licenses.ValidateLicenseKey(request.LicenseKey);
        if (payload is null)
        {
            logger.LogWarning("Sync: rejected a push with an invalid or expired license key.");
            return Unauthorized(new { error = "Invalid or expired license key." });
        }

        // 2. The key is for the tenant the batch claims. Without this, any valid license could push
        //    into any workspace.
        if (payload.TenantId != request.TenantId)
        {
            logger.LogWarning(
                "Sync: license for {LicenseTenant} was used to push into {ClaimedTenant}.",
                payload.TenantId, request.TenantId);
            return Unauthorized(new { error = "The license key does not belong to that workspace." });
        }

        // 3. The target really is a mirror. Pushing into a live cloud workspace would overwrite data
        //    somebody is actively editing.
        var tenant = await tenants.GetByIdAsync(request.TenantId, ct);
        if (tenant is null)
            return NotFound(new { error = "Workspace not found." });

        if (!tenant.IsMirror)
        {
            logger.LogWarning(
                "Sync: refused a push into {TenantId}, which is not a mirror workspace.", request.TenantId);
            return Conflict(new { error = "That workspace is not configured as a cloud mirror." });
        }

        if (checkTable && string.IsNullOrWhiteSpace(request.TableName))
            return BadRequest(new { error = "A table name is required." });

        return null;
    }
}
