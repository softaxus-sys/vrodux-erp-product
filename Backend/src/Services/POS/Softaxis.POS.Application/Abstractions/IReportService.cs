using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Abstractions;

public interface IReportService
{
    // Existing — used by cashier dashboard
    Task<DailySummaryDto> GetDailySummaryAsync(DateTime date, Guid? cashierId = null, CancellationToken ct = default);

    // Generic tabular reports (all 19 POS reports route through here)
    Task<ReportResult> RunReportAsync(string reportId, ReportParams p, CancellationToken ct = default);
}
