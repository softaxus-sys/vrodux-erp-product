using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Handlers.Setup;
using Softaxis.LeadGen.Infrastructure.Mail;
using Softaxis.LeadGen.Infrastructure.Persistence;

namespace Softaxis.LeadGen.Infrastructure.Services;

public sealed record UnsubscribeInfo(string Email, string? SenderName);

/// <summary>
/// Honours an unsubscribe the moment it is confirmed. The address is blocked for the workspace that
/// emailed it AND for the whole platform — someone who says "stop" to one company should not then
/// receive the same thing from another sender on the same system.
///
/// The public page is a two-step: the link only SHOWS who is unsubscribing, and a button confirms.
/// Email security scanners and link previews fetch every URL in a message; if opening the link
/// unsubscribed people, every recipient behind such a scanner would be silently lost.
/// </summary>
public interface IUnsubscribeService
{
    Task<UnsubscribeInfo?> DescribeAsync(string token, CancellationToken ct);
    Task<bool> ConfirmAsync(string token, CancellationToken ct);
}

internal sealed class UnsubscribeService(LeadGenDbContext db, IUnsubscribeTokens tokens) : IUnsubscribeService
{
    public async Task<UnsubscribeInfo?> DescribeAsync(string token, CancellationToken ct)
    {
        var t = tokens.Read(token);
        if (t is null) return null;
        var previous = (TenantAmbient.IsResolved, TenantAmbient.TenantId, TenantAmbient.IsSuperAdmin);
        try
        {
            TenantAmbient.Set(t.Value.TenantId, isSuperAdmin: false, isResolved: true);
            var sender = (await db.Profiles.AsNoTracking().FirstOrDefaultAsync(ct))?.SenderBusinessName;
            return new UnsubscribeInfo(t.Value.Email, sender);
        }
        finally { Restore(previous); }
    }

    public async Task<bool> ConfirmAsync(string token, CancellationToken ct)
    {
        var t = tokens.Read(token);
        if (t is null) return false;
        var (tenantId, email, _) = t.Value;

        var previous = (TenantAmbient.IsResolved, TenantAmbient.TenantId, TenantAmbient.IsSuperAdmin);
        try
        {
            TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
            await SuppressionSupport.AddAsync(db, SuppressionKind.Email, email, SuppressionReason.Unsubscribed, "unsubscribe link", null, alsoGlobal: true, ct);

            foreach (var r in await db.Recipients.Where(r => r.Email == email && (r.Status == RecipientStatus.Pending || r.Status == RecipientStatus.Active || r.Status == RecipientStatus.Completed)).ToListAsync(ct))
                r.Close(RecipientStatus.Unsubscribed);
            foreach (var p in await db.Prospects.Where(p => !p.IsDeleted && p.Email == email).ToListAsync(ct))
                p.SetStatus(ProspectStatus.DoNotContact);

            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException)
        {
            // The same address unsubscribed twice at once. It is already suppressed, which is what was asked for.
            return true;
        }
        finally { Restore(previous); }
    }

    private static void Restore((bool IsResolved, Guid? TenantId, bool IsSuperAdmin) previous)
    {
        if (previous.IsResolved) TenantAmbient.Set(previous.TenantId, previous.IsSuperAdmin, true);
        else TenantAmbient.Clear();
    }
}
