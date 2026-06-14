using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantIndustry;

public sealed record SetTenantIndustryCommand(Guid Id, string? Industry) : ICommand<TenantDto>;
