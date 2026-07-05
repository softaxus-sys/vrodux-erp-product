using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.DealContacts.Dtos;

namespace Softaxis.CRM.Application.DealContacts.Queries;

public sealed record GetDealContactsQuery(Guid DealId) : IQuery<IReadOnlyList<DealContactDto>>;
