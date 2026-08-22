using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Reports.Dtos;
using Softaxis.CRM.Application.Reports.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Read-only CRM reporting. Every report runs through the same record-level access guard as the list
/// screens, so a rep granted <c>crm.reports.view</c> sees their own numbers and a manager sees their
/// team's — a report can never be used as a side channel to totals the caller could not otherwise open.
/// </summary>
[ApiController][Route("api/crm/reports")][Authorize]
[RequirePermission("crm.reports.view")]
public sealed class CrmReportsController(ISender sender) : CrmControllerBase
{
    /// <summary>
    /// Query-string shape for the shared report filter. A bindable class rather than the
    /// <see cref="ReportFilter"/> record itself: positional records expose init-only properties and no
    /// parameterless constructor, which ASP.NET Core's complex-type query binding cannot populate.
    /// </summary>
    public sealed class ReportFilterQuery
    {
        public DateTime? From        { get; set; }
        public DateTime? To          { get; set; }
        public Guid?     OwnerUserId { get; set; }
        public string?   Source      { get; set; }
        public string?   Stage       { get; set; }
        public Guid?     CustomerId  { get; set; }

        public ReportFilter ToFilter() => new(From, To, OwnerUserId, Source, Stage, CustomerId);
    }

    [HttpGet("pipeline")]
    public async Task<IActionResult> Pipeline([FromQuery] ReportFilterQuery filter, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSalesPipelineReportQuery(filter.ToFilter()), ct));

    [HttpGet("win-loss")]
    public async Task<IActionResult> WinLoss([FromQuery] ReportFilterQuery filter, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWinLossReportQuery(filter.ToFilter()), ct));

    [HttpGet("performance")]
    public async Task<IActionResult> Performance([FromQuery] ReportFilterQuery filter, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSalesPerformanceReportQuery(filter.ToFilter()), ct));

    [HttpGet("lead-sources")]
    public async Task<IActionResult> LeadSources([FromQuery] ReportFilterQuery filter, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetLeadSourceReportQuery(filter.ToFilter()), ct));

    [HttpGet("conversion")]
    public async Task<IActionResult> Conversion([FromQuery] ReportFilterQuery filter, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetLeadConversionReportQuery(filter.ToFilter()), ct));

    [HttpGet("velocity")]
    public async Task<IActionResult> Velocity([FromQuery] ReportFilterQuery filter, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetVelocityReportQuery(filter.ToFilter()), ct));

    [HttpGet("activities")]
    public async Task<IActionResult> Activities([FromQuery] ReportFilterQuery filter, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetActivityReportQuery(filter.ToFilter()), ct));

    [HttpGet("accounts")]
    public async Task<IActionResult> Accounts([FromQuery] ReportFilterQuery filter, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAccountRevenueReportQuery(filter.ToFilter()), ct));
}
