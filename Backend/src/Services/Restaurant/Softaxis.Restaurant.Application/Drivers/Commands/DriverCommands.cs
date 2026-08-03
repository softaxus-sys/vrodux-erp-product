using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Drivers.Dtos;

namespace Softaxis.Restaurant.Application.Drivers.Commands;

public sealed record CreateDriverCommand(string Name, string Phone, string? VehicleInfo, Guid? LinkedUserId, Guid? BranchId = null)
    : ICommand<DriverDto>;

public sealed class CreateDriverValidator : AbstractValidator<CreateDriverCommand>
{
    public CreateDriverValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(50);
    }
}

public sealed record UpdateDriverCommand(Guid Id, string Name, string Phone, string? VehicleInfo, bool IsActive) : ICommand<DriverDto>;

public sealed class UpdateDriverValidator : AbstractValidator<UpdateDriverCommand>
{
    public UpdateDriverValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(50);
    }
}

public sealed record DeleteDriverCommand(Guid Id) : ICommand;
