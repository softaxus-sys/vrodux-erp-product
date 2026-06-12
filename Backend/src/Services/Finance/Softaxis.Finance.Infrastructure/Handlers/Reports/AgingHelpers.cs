using Softaxis.Finance.Application.Reports.Dtos;

namespace Softaxis.Finance.Infrastructure.Handlers.Reports;

internal static class AgingHelpers
{
    public static readonly string[] BucketOrder = ["current", "1-30", "31-60", "61-90", "90+"];

    public static (int daysOverdue, string bucket) Classify(string dueDate, DateOnly asOf)
    {
        if (!DateOnly.TryParse(dueDate, out var due))
            return (0, "current");

        var daysOverdue = asOf.DayNumber - due.DayNumber;

        var bucket = daysOverdue switch
        {
            <= 0 => "current",
            <= 30 => "1-30",
            <= 60 => "31-60",
            <= 90 => "61-90",
            _ => "90+",
        };

        return (Math.Max(0, daysOverdue), bucket);
    }

    public static IReadOnlyList<AgingBucketTotalDto> BuildBucketTotals(IEnumerable<AgingLineDto> lines)
    {
        var totals = lines.GroupBy(l => l.Bucket).ToDictionary(g => g.Key, g => g.Sum(l => l.AmountDue));
        return BucketOrder.Select(b => new AgingBucketTotalDto(b, totals.GetValueOrDefault(b))).ToList();
    }
}
