using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Branches.Queries.GetBranchById;

public sealed record GetBranchByIdQuery(Guid Id) : IQuery<BranchDto>;
