using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.CRM.Application.B2B.Dtos;

namespace Softaxis.CRM.Application.B2B.Queries;

public sealed record GetB2BSummaryQuery : IQuery<B2BSummaryDto>;

public sealed record GetProposalsQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<ProposalDto>>;

public sealed record GetContractsQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<ServiceContractDto>>;

public sealed record GetTicketsQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<SupportTicketDto>>;
