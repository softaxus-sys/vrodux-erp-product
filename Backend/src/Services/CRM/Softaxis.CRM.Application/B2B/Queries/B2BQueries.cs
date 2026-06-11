using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.B2B.Dtos;

namespace Softaxis.CRM.Application.B2B.Queries;

public sealed record GetB2BSummaryQuery : IQuery<B2BSummaryDto>;

public sealed record GetProposalsQuery : IQuery<IReadOnlyList<ProposalDto>>;

public sealed record GetContractsQuery : IQuery<IReadOnlyList<ServiceContractDto>>;

public sealed record GetTicketsQuery : IQuery<IReadOnlyList<SupportTicketDto>>;
