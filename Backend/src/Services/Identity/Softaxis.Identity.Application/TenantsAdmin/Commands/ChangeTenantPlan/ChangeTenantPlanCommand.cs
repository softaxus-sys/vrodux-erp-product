using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.ChangeTenantPlan;

public sealed record ChangeTenantPlanCommand(Guid Id, string Plan) : ICommand<TenantDto>;
