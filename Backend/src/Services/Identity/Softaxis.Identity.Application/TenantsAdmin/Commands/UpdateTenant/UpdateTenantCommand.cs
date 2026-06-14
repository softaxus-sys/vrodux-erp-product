using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.UpdateTenant;

public sealed record UpdateTenantCommand(
    Guid    Id,
    string  Name,
    string? ContactEmail,
    string? ContactPhone,
    string? Country,
    string? PrimaryColor) : ICommand<TenantDto>;
