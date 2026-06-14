using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Leads.Dtos;

namespace Softaxis.CRM.Application.Leads.Queries;

public sealed record GetLeadsQuery : IQuery<IReadOnlyList<LeadDto>>;

public sealed record GetLeadByIdQuery(Guid Id) : IQuery<LeadDto>;

public sealed record GetLeadsSummaryQuery : IQuery<LeadsSummaryDto>;
