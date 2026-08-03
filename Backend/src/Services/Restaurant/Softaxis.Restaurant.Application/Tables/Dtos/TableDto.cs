namespace Softaxis.Restaurant.Application.Tables.Dtos;

public sealed record TableDto(
    Guid Id,
    string TableNumber,
    string Section,
    int Capacity,
    string Status,
    Guid? CurrentOrderId,
    string? CurrentWaiter,
    DateTime? OccupiedSince,
    Guid? BranchId,
    Guid? DiningAreaId,
    double? PosX,
    double? PosY,
    string Shape,
    int Rotation,
    Guid? MergedIntoTableId);

public sealed record TablesSummaryDto(
    int Total,
    int Available,
    int Occupied,
    int Reserved,
    int Cleaning,
    double OccupancyRate,
    int TotalCovers);
