using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.GenerateTenantLicense;

public sealed record GenerateTenantLicenseCommand(
    Guid     Id,
    int      ValidityDays,
    string[] Features,
    // Optional. The customer's machine code (from their activation screen). Blank = unbound.
    string?  MachineCode = null) : ICommand<GenerateLicenseResponse>;
