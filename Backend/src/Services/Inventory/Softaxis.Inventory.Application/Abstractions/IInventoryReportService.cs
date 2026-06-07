namespace Softaxis.Inventory.Application.Abstractions;

public sealed record InvReportParams(
    DateTime From,
    DateTime To,
    Guid?    WarehouseId      = null,
    Guid?    CategoryId       = null,
    string?  ValuationMethod  = null,
    string?  MovementType     = null,
    string?  FiscalYear       = null,
    string?  ItcStatus        = null,
    string?  WriteOffReason   = null,
    string?  FromProvince     = null,
    int      IdleDays         = 90,
    int      ExpiryWindowDays = 30);

public sealed record InvReportResult(
    IReadOnlyList<string>                      Columns,
    IReadOnlyList<Dictionary<string, object?>> Rows,
    int                                        TotalCount);

public interface IInventoryReportService
{
    Task<InvReportResult> RunReportAsync(string reportId, InvReportParams p, CancellationToken ct = default);
}
