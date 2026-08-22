namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// One stage transition on an opportunity — the raw material for every velocity, funnel and
/// stage-duration report. Append-only; never edited or deleted.
/// <para>
/// <b>Why <see cref="DaysInFromStage"/> is stored rather than derived:</b> computing time-in-stage at
/// query time needs a per-deal window function over the whole history table, which EF cannot translate
/// and which grows badly with volume. The duration is knowable at write time (now minus the previous
/// transition, or the deal's creation for the first move), so it is measured once and stored. Reports
/// then reduce to a plain GROUP BY / AVG.
/// </para>
/// Auto tenant-isolated (lives in Softaxis.CRM.Domain → shadow TenantId + global filter).
/// </summary>
public sealed class DealStageHistory
{
    private DealStageHistory() { }

    public DealStageHistory(Guid dealId, string? fromStage, string toStage, int probability,
        decimal valueAtChange, double daysInFromStage, Guid? changedByUserId, string? changedByName)
    {
        Id               = Guid.NewGuid();
        DealId           = dealId;
        FromStage        = Trim(fromStage);
        ToStage          = (toStage ?? string.Empty).Trim();
        Probability      = probability;
        ValueAtChange    = valueAtChange;
        // Clamped: a clock skew or an edited CreatedAt must never produce a negative duration that would
        // silently drag a stage's average below zero.
        DaysInFromStage  = Math.Max(0, daysInFromStage);
        ChangedByUserId  = changedByUserId;
        ChangedByName    = Trim(changedByName);
        CreatedAt        = DateTime.UtcNow;
    }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    public Guid     Id              { get; private set; }
    public Guid     DealId          { get; private set; }
    /// <summary>Stage the deal left. Null only for the row recording the deal's creation.</summary>
    public string?  FromStage       { get; private set; }
    public string   ToStage         { get; private set; } = string.Empty;
    /// <summary>Probability after the move — lets a forecast-accuracy report replay past confidence.</summary>
    public int      Probability     { get; private set; }
    /// <summary>Deal value at the moment of the move, so a later re-pricing cannot rewrite history.</summary>
    public decimal  ValueAtChange   { get; private set; }
    /// <summary>Days the deal sat in <see cref="FromStage"/> before this move. 0 on the creation row.</summary>
    public double   DaysInFromStage { get; private set; }
    public Guid?    ChangedByUserId { get; private set; }
    public string?  ChangedByName   { get; private set; }
    public DateTime CreatedAt       { get; private set; }
}
