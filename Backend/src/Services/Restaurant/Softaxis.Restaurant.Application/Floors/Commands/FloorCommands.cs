using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Floors.Dtos;

namespace Softaxis.Restaurant.Application.Floors.Commands;

/// <summary>POST /api/restaurant/floors</summary>
public sealed record CreateFloorCommand(string Name, int SortOrder, Guid? BranchId = null) : ICommand<FloorDto>;

public sealed class CreateFloorValidator : AbstractValidator<CreateFloorCommand>
{
    public CreateFloorValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
}

/// <summary>PUT /api/restaurant/floors/{id}</summary>
public sealed record UpdateFloorCommand(Guid Id, string Name, int SortOrder) : ICommand<FloorDto>;

public sealed class UpdateFloorValidator : AbstractValidator<UpdateFloorCommand>
{
    public UpdateFloorValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
}

/// <summary>DELETE /api/restaurant/floors/{id} — rejected if it still has dining areas.</summary>
public sealed record DeleteFloorCommand(Guid Id) : ICommand;

/// <summary>POST /api/restaurant/floors/{floorId}/dining-areas</summary>
public sealed record CreateDiningAreaCommand(Guid FloorId, string Name, string Type, int SortOrder) : ICommand<DiningAreaDto>;

public sealed class CreateDiningAreaValidator : AbstractValidator<CreateDiningAreaCommand>
{
    public CreateDiningAreaValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Type).NotEmpty().MaximumLength(30);
    }
}

/// <summary>PUT /api/restaurant/floors/{floorId}/dining-areas/{id}</summary>
public sealed record UpdateDiningAreaCommand(Guid Id, string Name, string Type, int SortOrder) : ICommand<DiningAreaDto>;

public sealed class UpdateDiningAreaValidator : AbstractValidator<UpdateDiningAreaCommand>
{
    public UpdateDiningAreaValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Type).NotEmpty().MaximumLength(30);
    }
}

/// <summary>DELETE /api/restaurant/floors/{floorId}/dining-areas/{id} — rejected if tables are still assigned.</summary>
public sealed record DeleteDiningAreaCommand(Guid Id) : ICommand;
