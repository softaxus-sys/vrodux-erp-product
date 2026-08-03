using Softaxis.Restaurant.Application.Tables.Dtos;

namespace Softaxis.Restaurant.Application.Floors.Dtos;

public sealed record FloorDto(Guid Id, Guid? BranchId, string Name, int SortOrder);

public sealed record DiningAreaDto(Guid Id, Guid FloorId, string Name, string Type, int SortOrder);

/// <summary>Full nested tree (Floor → DiningAreas → Tables) for the floor designer canvas.</summary>
public sealed record FloorLayoutDto(
    Guid Id, Guid? BranchId, string Name, int SortOrder,
    IReadOnlyList<DiningAreaLayoutDto> DiningAreas);

public sealed record DiningAreaLayoutDto(
    Guid Id, Guid FloorId, string Name, string Type, int SortOrder,
    IReadOnlyList<TableDto> Tables);
