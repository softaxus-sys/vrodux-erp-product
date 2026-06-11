using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.License.Dtos;

namespace Softaxis.Identity.Application.License.Commands.Heartbeat;

/// <summary>
/// Recorded daily by on-prem instances to confirm they're connected and licensed.
/// </summary>
public sealed record LicenseHeartbeatCommand(Guid TenantId, string LicenseKey) : ICommand<LicenseHeartbeatResultDto>;
