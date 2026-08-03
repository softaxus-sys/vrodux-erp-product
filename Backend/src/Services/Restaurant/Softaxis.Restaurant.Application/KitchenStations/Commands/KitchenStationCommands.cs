using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.KitchenStations.Dtos;

namespace Softaxis.Restaurant.Application.KitchenStations.Commands;

public sealed record CreateKitchenStationCommand(
    string Name, string? DisplayName, string? ColorTag, int SortOrder, Guid? PrinterProfileId, Guid? BranchId = null
) : ICommand<KitchenStationDto>;

public sealed class CreateKitchenStationValidator : AbstractValidator<CreateKitchenStationCommand>
{
    public CreateKitchenStationValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
}

public sealed record UpdateKitchenStationCommand(
    Guid Id, string Name, string? DisplayName, string? ColorTag, int SortOrder, Guid? PrinterProfileId
) : ICommand<KitchenStationDto>;

public sealed class UpdateKitchenStationValidator : AbstractValidator<UpdateKitchenStationCommand>
{
    public UpdateKitchenStationValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
}

public sealed record DeleteKitchenStationCommand(Guid Id) : ICommand;
