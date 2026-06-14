using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.Trial.Dtos;

namespace Softaxis.Identity.Application.Trial.Queries.GetTrialChallenge;

/// <summary>Issues a short-lived single-use challenge token for trial registration.</summary>
public sealed record GetTrialChallengeQuery(string? RemoteIp) : IQuery<TrialChallengeDto>;
