namespace Softaxis.CRM.Application.Reports.Dtos;

/// <summary>
/// Filters shared by every CRM report. All optional — an empty filter means "everything I'm allowed
/// to see, all time". <paramref name="From"/>/<paramref name="To"/> are inclusive dates; each report
/// documents which date it applies them to (close date, conversion date, creation date, …), because
/// "deals in July" means different things for an open pipeline than for a won/lost analysis.
/// </summary>
public sealed record ReportFilter(
    DateTime? From        = null,
    DateTime? To          = null,
    Guid?     OwnerUserId = null,
    string?   Source      = null,
    string?   Stage       = null,
    Guid?     CustomerId  = null)
{
    /// <summary>End of the "To" day. Callers pass a date; rows are stamped with a time, so an inclusive
    /// upper bound has to run to the end of that day or the last day of a range silently drops out.</summary>
    public DateTime? ToInclusive => To?.Date.AddDays(1).AddTicks(-1);
    public DateTime? FromInclusive => From?.Date;
}

// ── 1. Sales pipeline ────────────────────────────────────────────────────────

public sealed record PipelineStageRowDto(
    string Stage, int Count, decimal Value, decimal WeightedValue, decimal AvgDealSize);

public sealed record ForecastCategoryRowDto(string Category, int Count, decimal Value);

public sealed record SalesPipelineReportDto(
    IReadOnlyList<PipelineStageRowDto>    ByStage,
    IReadOnlyList<ForecastCategoryRowDto> ByForecastCategory,
    int     OpenCount,
    decimal OpenValue,
    decimal WeightedValue,
    decimal CommitValue,
    decimal BestCaseValue,
    decimal AvgDealSize);

// ── 2. Win / loss ────────────────────────────────────────────────────────────

public sealed record WinLossTrendPointDto(
    string Period, int Won, int Lost, decimal WonValue, decimal LostValue, double WinRate);

public sealed record LossReasonRowDto(string Reason, int Count, decimal Value, double Share);

public sealed record WinLossReportDto(
    int     WonCount,
    int     LostCount,
    decimal WonValue,
    decimal LostValue,
    double  WinRate,
    decimal AvgWonDealSize,
    double  AvgDaysToClose,
    IReadOnlyList<WinLossTrendPointDto> Trend,
    IReadOnlyList<LossReasonRowDto>     LossReasons);

// ── 3. Sales performance by owner ────────────────────────────────────────────

public sealed record OwnerPerformanceRowDto(
    Guid?   OwnerUserId,
    string  OwnerName,
    int     LeadsOwned,
    int     LeadsConverted,
    double  LeadConversionRate,
    int     OpenDeals,
    decimal OpenValue,
    int     WonDeals,
    decimal WonValue,
    int     LostDeals,
    double  WinRate,
    int     ActivitiesLogged,
    int     OverdueActivities);

/// <summary>
/// One team's slice of the performance report. Totals are summed over the team's members, so a
/// manager can compare teams without adding up rows by hand.
/// </summary>
public sealed record TeamPerformanceDto(
    Guid    TeamId,
    string  TeamName,
    string? TeamLeadName,
    IReadOnlyList<OwnerPerformanceRowDto> Members,
    int     TotalLeads,
    int     TotalWonDeals,
    decimal TotalWonValue,
    decimal TotalOpenValue);

public sealed record SalesPerformanceReportDto(
    IReadOnlyList<OwnerPerformanceRowDto> Owners,
    decimal TotalWonValue,
    int     TotalWonDeals,
    /// <summary>
    /// Per-team breakdown. An admin or full-access role gets every team in the tenant; a team lead
    /// gets only the teams they lead. Empty for a rep who leads nothing — the flat
    /// <see cref="Owners"/> list still carries their own row.
    /// </summary>
    IReadOnlyList<TeamPerformanceDto>? Teams = null,
    /// <summary>
    /// Owners visible to the caller who belong to none of the teams above — surfaced explicitly so
    /// a person's numbers can never silently vanish just because nobody put them in a team.
    /// </summary>
    IReadOnlyList<OwnerPerformanceRowDto>? Ungrouped = null);

// ── 4. Lead source effectiveness ─────────────────────────────────────────────

public sealed record LeadSourceRowDto(
    string  Source,
    int     Leads,
    int     Converted,
    double  ConversionRate,
    decimal EstimatedValue,
    int     WonDeals,
    decimal WonValue,
    double  AvgScore,
    double  AvgDaysToConvert);

public sealed record LeadSourceReportDto(
    IReadOnlyList<LeadSourceRowDto> Sources,
    int     TotalLeads,
    int     TotalConverted,
    double  OverallConversionRate);

// ── 5. Lead conversion funnel ────────────────────────────────────────────────

public sealed record FunnelStageDto(
    string Stage, int Count, double ShareOfTotal, double StepConversionRate);

public sealed record ConversionTrendPointDto(string Period, int Created, int Converted, double Rate);

public sealed record LeadConversionReportDto(
    IReadOnlyList<FunnelStageDto>           Funnel,
    IReadOnlyList<ConversionTrendPointDto>  Trend,
    int    TotalLeads,
    int    Converted,
    double ConversionRate,
    double AvgDaysToConvert,
    double AvgScoreConverted,
    double AvgScoreUnconverted);

// ── 6. Sales velocity / stage duration ───────────────────────────────────────

public sealed record StageDurationRowDto(
    string Stage, int Transitions, double AvgDays, double MedianDays, int DealsCurrentlyHere);

public sealed record VelocityReportDto(
    IReadOnlyList<StageDurationRowDto> Stages,
    double  AvgSalesCycleDays,
    double  AvgDaysToWin,
    double  AvgDaysToLose,
    int     ClosedDealsAnalysed,
    bool    HasHistory,
    string? HistoryNote);

// ── 7. Activity report ───────────────────────────────────────────────────────

public sealed record ActivityTypeRowDto(string Type, int Total, int Completed, int Open, int Overdue);

public sealed record ActivityOwnerRowDto(
    string Owner, int Total, int Completed, int Open, int Overdue, double CompletionRate);

public sealed record ActivityReportDto(
    IReadOnlyList<ActivityTypeRowDto>  ByType,
    IReadOnlyList<ActivityOwnerRowDto> ByOwner,
    int    Total,
    int    Completed,
    int    Open,
    int    Overdue,
    double CompletionRate);

// ── 8. Account revenue ───────────────────────────────────────────────────────

public sealed record AccountRevenueRowDto(
    Guid    CustomerId,
    string  Name,
    string  Industry,
    string  Tier,
    string  AccountManager,
    int     TotalDeals,
    int     OpenDeals,
    decimal OpenValue,
    int     WonDeals,
    decimal WonValue,
    decimal RecordedRevenue,
    string? LastActivity);

public sealed record AccountRevenueReportDto(
    IReadOnlyList<AccountRevenueRowDto> Accounts,
    int     TotalAccounts,
    decimal TotalWonValue,
    decimal TotalOpenValue);
