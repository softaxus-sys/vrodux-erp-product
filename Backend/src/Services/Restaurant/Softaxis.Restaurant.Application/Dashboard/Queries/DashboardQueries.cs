using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Dashboard.Dtos;

namespace Softaxis.Restaurant.Application.Dashboard.Queries;

/// <summary>GET /api/restaurant/dashboard/owner?branchId= — tenant-wide (or one branch) business snapshot.</summary>
public sealed record GetOwnerDashboardQuery(Guid? BranchId = null) : IQuery<OwnerDashboardDto>;

/// <summary>GET /api/restaurant/dashboard/branch?branchId= — one branch's today snapshot + floor status.</summary>
public sealed record GetBranchDashboardQuery(Guid? BranchId = null) : IQuery<BranchDashboardDto>;

/// <summary>GET /api/restaurant/dashboard/kitchen?branchId= — active KDS load + today's prep-time signal.</summary>
public sealed record GetKitchenDashboardQuery(Guid? BranchId = null) : IQuery<KitchenDashboardDto>;

/// <summary>GET /api/restaurant/dashboard/cashier?sessionId= — the acting cashier's current shift snapshot.</summary>
public sealed record GetCashierDashboardQuery(Guid? SessionId = null) : IQuery<CashierDashboardDto>;

/// <summary>GET /api/restaurant/dashboard/inventory — recipe-linked low-stock signal + today's 86-list.</summary>
public sealed record GetInventoryDashboardQuery : IQuery<InventoryDashboardDto>;
