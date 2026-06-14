namespace Softaxis.Identity.Application.Trial.Dtos;

public sealed record TrialChallengeDto(string Token);

public sealed record TrialRegistrationResultDto(
    Guid      TenantId,
    string    TenantSlug,
    Guid      UserId,
    string    Email,
    DateTime? TrialEndsAt);
