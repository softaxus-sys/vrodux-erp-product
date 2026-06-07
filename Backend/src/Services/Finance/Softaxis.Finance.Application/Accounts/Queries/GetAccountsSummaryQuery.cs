using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Accounts.Dtos;

namespace Softaxis.Finance.Application.Accounts.Queries;

/// <summary>Returns aggregated balance totals by account type.</summary>
public sealed record GetAccountsSummaryQuery : IQuery<AccountSummaryDto>;
