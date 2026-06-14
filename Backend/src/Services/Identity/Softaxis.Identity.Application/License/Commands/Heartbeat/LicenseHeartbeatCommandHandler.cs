using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.License.Dtos;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.License.Commands.Heartbeat;

public sealed class LicenseHeartbeatCommandHandler(
    ITenantRepository tenantRepo,
    ILicenseService   licenseService,
    IUnitOfWork       uow)
    : ICommandHandler<LicenseHeartbeatCommand, LicenseHeartbeatResultDto>
{
    public async Task<Result<LicenseHeartbeatResultDto>> Handle(LicenseHeartbeatCommand cmd, CancellationToken ct)
    {
        if (cmd.TenantId == Guid.Empty || string.IsNullOrWhiteSpace(cmd.LicenseKey))
            return Result.Failure<LicenseHeartbeatResultDto>(
                Error.Custom("License.Invalid", "TenantId and LicenseKey are required."));

        var tenant = await tenantRepo.GetByIdAsync(cmd.TenantId, ct);
        if (tenant is null)
            return Result.Failure<LicenseHeartbeatResultDto>(Error.NotFoundById("Tenant", cmd.TenantId));

        var payload = licenseService.ValidateLicenseKey(cmd.LicenseKey);
        if (payload is null || payload.TenantId != cmd.TenantId)
            return Result.Failure<LicenseHeartbeatResultDto>(
                Error.Custom("License.Forbidden", "License key is invalid or expired."));

        tenant.RecordHeartbeat();
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new LicenseHeartbeatResultDto(
            Valid:      true,
            Plan:       payload.Plan,
            MaxUsers:   payload.MaxUsers,
            ExpiresAt:  payload.ExpiresAt,
            ServerTime: DateTime.UtcNow));
    }
}
