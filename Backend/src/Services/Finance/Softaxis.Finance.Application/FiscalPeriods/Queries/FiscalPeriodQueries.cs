using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.FiscalPeriods.Dtos;

namespace Softaxis.Finance.Application.FiscalPeriods.Queries;

/// <summary>Lists fiscal periods. Periods that have never been closed/touched are synthesized as "open".</summary>
public sealed record GetFiscalPeriodsQuery(int? Year) : IQuery<IReadOnlyList<FiscalPeriodDto>>;
