using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Dashboard.Dtos;

namespace Softaxis.CRM.Application.Dashboard.Queries;

public sealed record GetCrmDashboardQuery : IQuery<CrmDashboardDto>;
