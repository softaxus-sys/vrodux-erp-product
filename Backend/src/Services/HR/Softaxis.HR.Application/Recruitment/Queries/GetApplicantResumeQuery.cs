using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Recruitment.Dtos;

namespace Softaxis.HR.Application.Recruitment.Queries;

public sealed record GetApplicantResumeQuery(Guid Id) : IQuery<ApplicantResumeDto>;
