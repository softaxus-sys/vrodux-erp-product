using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Sessions.Queries.GetSessionById;

public sealed record GetSessionByIdQuery(Guid Id) : IQuery<POSSessionDto>;
