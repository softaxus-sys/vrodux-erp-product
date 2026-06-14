using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Recruitment.Dtos;

namespace Softaxis.HR.Application.Recruitment.Queries;

public sealed record GetApplicantsQuery(
    int     Page     = 1,
    int     PageSize = 20,
    Guid?   JobId    = null,
    string? Stage    = null
) : IQuery<PagedResult<ApplicantDto>>;
