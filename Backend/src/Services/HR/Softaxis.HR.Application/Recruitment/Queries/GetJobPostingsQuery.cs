using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Recruitment.Dtos;

namespace Softaxis.HR.Application.Recruitment.Queries;

public sealed record GetJobPostingsQuery(
    int     Page     = 1,
    int     PageSize = 20,
    string? Status   = null
) : IQuery<PagedResult<JobPostingDto>>;
