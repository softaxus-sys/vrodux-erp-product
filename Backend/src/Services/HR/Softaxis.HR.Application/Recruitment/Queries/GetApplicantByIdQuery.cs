using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Recruitment.Dtos;

namespace Softaxis.HR.Application.Recruitment.Queries;

public sealed record GetApplicantByIdQuery(Guid Id) : IQuery<ApplicantDto>;
