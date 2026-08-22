using Softaxis.CRM.Application.Reports.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Reports;

/// <summary>
/// Filter application and small maths shared by the report handlers, so "what does this filter mean"
/// is answered in exactly one place per entity.
/// <para>
/// Every query in this folder must also apply <c>!IsDeleted</c> by hand: the tenant global filter
/// replaces any entity-level soft-delete filter (documented across CRM/Visa/Restaurant), so a report
/// that forgets it silently counts deleted records and disagrees with the list screens.
/// </para>
/// </summary>
internal static class ReportQueryHelpers
{
    // ── Deals ────────────────────────────────────────────────────────────────

    /// <summary>Owner / source / stage / account filters. Date is deliberately NOT applied here —
    /// each report decides whether its window means created, closed, or moved.</summary>
    public static IQueryable<Deal> ApplyDealFilters(IQueryable<Deal> q, ReportFilter f)
    {
        q = q.Where(d => !d.IsDeleted);
        if (f.OwnerUserId is Guid owner) q = q.Where(d => d.AssignedToUserId == owner);
        if (f.CustomerId is Guid cust) q = q.Where(d => d.CustomerId == cust);
        if (!string.IsNullOrWhiteSpace(f.Source)) q = q.Where(d => d.Source == f.Source);
        if (!string.IsNullOrWhiteSpace(f.Stage)) q = q.Where(d => d.Stage == f.Stage);
        return q;
    }

    public static IQueryable<Deal> ApplyDealCreatedWindow(IQueryable<Deal> q, ReportFilter f)
    {
        if (f.FromInclusive is DateTime from) q = q.Where(d => d.CreatedAt >= from);
        if (f.ToInclusive is DateTime to) q = q.Where(d => d.CreatedAt <= to);
        return q;
    }

    public static IQueryable<Deal> ApplyDealClosedWindow(IQueryable<Deal> q, ReportFilter f)
    {
        if (f.FromInclusive is DateTime from) q = q.Where(d => d.ClosedAt >= from);
        if (f.ToInclusive is DateTime to) q = q.Where(d => d.ClosedAt <= to);
        return q;
    }

    // ── Leads ────────────────────────────────────────────────────────────────

    public static IQueryable<Lead> ApplyLeadFilters(IQueryable<Lead> q, ReportFilter f)
    {
        q = q.Where(l => !l.IsDeleted);
        if (f.OwnerUserId is Guid owner) q = q.Where(l => l.AssignedToUserId == owner);
        if (!string.IsNullOrWhiteSpace(f.Source)) q = q.Where(l => l.Source == f.Source);
        if (f.FromInclusive is DateTime from) q = q.Where(l => l.CreatedAt >= from);
        if (f.ToInclusive is DateTime to) q = q.Where(l => l.CreatedAt <= to);
        return q;
    }

    // ── Maths ────────────────────────────────────────────────────────────────

    /// <summary>Percentage to one decimal place; 0 when the denominator is 0 (never NaN — a NaN reaches
    /// the UI as "NaN%" or breaks JSON serialisation for double.NaN).</summary>
    public static double Rate(int part, int whole) =>
        whole <= 0 ? 0 : Math.Round((double)part / whole * 100, 1);

    public static double Avg(IEnumerable<double> values)
    {
        var list = values as IList<double> ?? values.ToList();
        return list.Count == 0 ? 0 : Math.Round(list.Average(), 1);
    }

    public static double Median(IEnumerable<double> values)
    {
        var sorted = values.OrderBy(v => v).ToList();
        if (sorted.Count == 0) return 0;
        var mid = sorted.Count / 2;
        var median = sorted.Count % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2d;
        return Math.Round(median, 1);
    }

    /// <summary>Month bucket key, e.g. "2026-07" — sorts lexically, which keeps trend ordering trivial.</summary>
    public static string MonthKey(DateTime dt) => dt.ToString("yyyy-MM");

    public static string Fallback(string? value, string whenEmpty = "unspecified") =>
        string.IsNullOrWhiteSpace(value) ? whenEmpty : value.Trim();

    /// <summary>Deal stages in board order, so every report lists them the same way the pipeline does.</summary>
    public static readonly string[] DealStages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

    /// <summary>Lead statuses in funnel order.</summary>
    public static readonly string[] LeadStatuses = ["new", "contacted", "qualified", "converted"];
}
