using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Services;

/// <summary>
/// Writes the <see cref="DealStageHistory"/> trail behind every opportunity. Centralised so the three
/// places a stage can change (create, board move, edit form) cannot drift apart — a gap in any one of
/// them would silently corrupt the velocity and funnel reports rather than fail loudly.
/// </summary>
public interface IDealStageRecorder
{
    /// <summary>Records the deal's opening stage. Call once, right after the deal is created.</summary>
    void RecordCreated(Deal deal);

    /// <summary>Records a transition if <paramref name="previousStage"/> actually differs from the deal's
    /// current stage. A no-op otherwise, so callers can invoke it unconditionally after any save path.</summary>
    Task RecordMoveAsync(Deal deal, string previousStage, CancellationToken ct);
}

internal sealed class DealStageRecorder(CrmDbContext db, ICurrentUser user) : IDealStageRecorder
{
    public void RecordCreated(Deal deal) =>
        db.DealStageHistory.Add(new DealStageHistory(
            deal.Id, fromStage: null, toStage: deal.Stage, deal.Probability, deal.Value,
            daysInFromStage: 0, user.Id, user.Username));

    public async Task RecordMoveAsync(Deal deal, string previousStage, CancellationToken ct)
    {
        if (string.Equals(previousStage, deal.Stage, StringComparison.OrdinalIgnoreCase)) return;

        // How long the deal sat in the stage it is leaving: since its last transition, or since the deal
        // was created if this is its first. Deals created before history existed have no rows, so they
        // correctly fall back to their creation date.
        var lastMoveAt = await db.DealStageHistory.AsNoTracking()
            .Where(h => h.DealId == deal.Id)
            .OrderByDescending(h => h.CreatedAt)
            .Select(h => (DateTime?)h.CreatedAt)
            .FirstOrDefaultAsync(ct);

        var days = (DateTime.UtcNow - (lastMoveAt ?? deal.CreatedAt)).TotalDays;

        db.DealStageHistory.Add(new DealStageHistory(
            deal.Id, previousStage, deal.Stage, deal.Probability, deal.Value,
            days, user.Id, user.Username));
    }
}
