using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Infrastructure.Fbr;

internal static class FbrAfterPayment
{
    /// <summary>Once a bill is fully paid, report it to FBR straight away so the receipt can carry
    /// the fiscal invoice number. A failure leaves the payment untouched; the retry job resends.</summary>
    public static async Task<Result<OrderDto>> ReportIfDueAsync(FbrReporter fbr, Result<OrderDto> result, CancellationToken ct)
    {
        if (result.IsFailure || result.Value.Status != "paid" || result.Value.FbrStatus is not ("pending" or "failed"))
            return result;
        var report = await fbr.ReportAsync(result.Value.Id, ct);
        return report is null ? result : Result.Success(result.Value with
        {
            FbrStatus = report.Status, FbrInvoiceNumber = report.InvoiceNumber, FbrError = report.Error,
        });
    }
}
