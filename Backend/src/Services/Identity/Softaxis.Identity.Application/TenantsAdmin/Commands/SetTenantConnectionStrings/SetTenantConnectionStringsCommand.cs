using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantConnectionStrings;

public sealed record SetTenantConnectionStringsCommand(
    Guid   Id,
    string IdentityDb,
    string PosDb,
    string InventoryDb) : ICommand<TenantDto>;
