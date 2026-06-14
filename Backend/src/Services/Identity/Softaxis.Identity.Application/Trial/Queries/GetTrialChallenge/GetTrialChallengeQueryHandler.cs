using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Trial.Dtos;

namespace Softaxis.Identity.Application.Trial.Queries.GetTrialChallenge;

public sealed class GetTrialChallengeQueryHandler(
    ITrialChallengeService challengeService,
    ILogger<GetTrialChallengeQueryHandler> logger)
    : IQueryHandler<GetTrialChallengeQuery, TrialChallengeDto>
{
    public Task<Result<TrialChallengeDto>> Handle(GetTrialChallengeQuery query, CancellationToken ct)
    {
        var token = challengeService.Generate();
        logger.LogInformation("Trial challenge issued to {IP}", query.RemoteIp);
        return Task.FromResult(Result.Success(new TrialChallengeDto(token)));
    }
}
