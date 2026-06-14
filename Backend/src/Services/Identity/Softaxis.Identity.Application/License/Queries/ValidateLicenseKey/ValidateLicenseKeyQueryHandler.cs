using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.License.Dtos;

namespace Softaxis.Identity.Application.License.Queries.ValidateLicenseKey;

public sealed class ValidateLicenseKeyQueryHandler(ILicenseService licenseService)
    : IQueryHandler<ValidateLicenseKeyQuery, LicenseValidationDto>
{
    public Task<Result<LicenseValidationDto>> Handle(ValidateLicenseKeyQuery query, CancellationToken ct)
    {
        var payload = licenseService.ValidateLicenseKey(query.LicenseKey);
        if (payload is null)
            return Task.FromResult(Result.Success(new LicenseValidationDto(Valid: false)));

        return Task.FromResult(Result.Success(new LicenseValidationDto(
            Valid:      true,
            TenantId:   payload.TenantId,
            TenantSlug: payload.TenantSlug,
            Plan:       payload.Plan,
            MaxUsers:   payload.MaxUsers,
            Features:   payload.Features,
            IssuedAt:   payload.IssuedAt,
            ExpiresAt:  payload.ExpiresAt)));
    }
}
