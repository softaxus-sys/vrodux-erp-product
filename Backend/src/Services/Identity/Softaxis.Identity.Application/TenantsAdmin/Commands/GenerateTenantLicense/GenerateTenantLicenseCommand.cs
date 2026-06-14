using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.GenerateTenantLicense;

public sealed record GenerateTenantLicenseCommand(
    Guid     Id,
    int      ValidityDays,
    string[] Features) : ICommand<GenerateLicenseResponse>;
