using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Contacts.Dtos;

namespace Softaxis.CRM.Application.Contacts.Queries;

public sealed record GetContactsQuery(Guid? CustomerId) : IQuery<IReadOnlyList<ContactDto>>;
