using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Reports.Queries.GetDailySummary;

public sealed record GetDailySummaryQuery(
    DateTime Date,
    Guid?    CashierId = null) : IQuery<DailySummaryDto>;
