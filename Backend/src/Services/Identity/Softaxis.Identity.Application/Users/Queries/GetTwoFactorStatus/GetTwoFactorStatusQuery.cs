using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Users.Queries.GetTwoFactorStatus;

public sealed record GetTwoFactorStatusQuery(Guid UserId) : IQuery<TwoFactorStatusDto>;
