using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Sessions.Queries.GetActiveSessions;

public sealed record GetActiveSessionsQuery : IQuery<IReadOnlyList<POSSessionSummaryDto>>;
