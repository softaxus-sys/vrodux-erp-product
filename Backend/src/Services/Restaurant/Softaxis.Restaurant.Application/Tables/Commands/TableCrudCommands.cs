using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Tables.Dtos;

namespace Softaxis.Restaurant.Application.Tables.Commands;

/// <summary>PUT /api/restaurant/tables/{id}</summary>
public sealed record UpdateTableCommand(
    Guid Id, string TableNumber, string Section, int Capacity, Guid? DiningAreaId
) : ICommand<TableDto>;

public sealed class UpdateTableValidator : AbstractValidator<UpdateTableCommand>
{
    public UpdateTableValidator()
    {
        RuleFor(x => x.TableNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Section).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Capacity).GreaterThan(0);
    }
}

/// <summary>DELETE /api/restaurant/tables/{id}</summary>
public sealed record DeleteTableCommand(Guid Id) : ICommand;

/// <summary>PATCH /api/restaurant/tables/{id}/position — one table's placement on the designer canvas.</summary>
public sealed record RepositionTableCommand(Guid Id, double PosX, double PosY, string Shape, int Rotation) : ICommand<TableDto>;

/// <summary>PUT /api/restaurant/tables/layout — batch position update (drag-drop save-all from the designer).</summary>
public sealed record UpdateTableLayoutCommand(IReadOnlyList<TableLayoutInput> Tables) : ICommand;

public sealed record TableLayoutInput(Guid Id, double PosX, double PosY, string Shape, int Rotation);

/// <summary>POST /api/restaurant/tables/{id}/merge — merges a table into another for a large party.</summary>
public sealed record MergeTableCommand(Guid Id, Guid TargetTableId) : ICommand<TableDto>;

/// <summary>POST /api/restaurant/tables/{id}/unmerge</summary>
public sealed record UnmergeTableCommand(Guid Id) : ICommand<TableDto>;
