using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.RenewTenantSubscription;

public sealed record RenewTenantSubscriptionCommand(Guid Id, DateTime ExpiresAt) : ICommand<TenantDto>;
