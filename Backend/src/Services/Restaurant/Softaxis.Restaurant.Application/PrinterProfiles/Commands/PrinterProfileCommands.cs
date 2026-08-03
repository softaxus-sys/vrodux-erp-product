using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.PrinterProfiles.Dtos;

namespace Softaxis.Restaurant.Application.PrinterProfiles.Commands;

public sealed record CreatePrinterProfileCommand(
    string Name, string Type, string ConnectionType, string? IpAddress, int? Port, bool IsDefault, Guid? BranchId = null
) : ICommand<PrinterProfileDto>;

public sealed class CreatePrinterProfileValidator : AbstractValidator<CreatePrinterProfileCommand>
{
    private static readonly string[] Types = ["receipt", "kitchen"];
    private static readonly string[] ConnTypes = ["network", "usb", "bluetooth"];

    public CreatePrinterProfileValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Type).Must(t => Types.Contains(t)).WithMessage("Type must be 'receipt' or 'kitchen'.");
        RuleFor(x => x.ConnectionType).Must(t => ConnTypes.Contains(t)).WithMessage("Invalid connection type.");
    }
}

public sealed record UpdatePrinterProfileCommand(
    Guid Id, string Name, string Type, string ConnectionType, string? IpAddress, int? Port, bool IsDefault
) : ICommand<PrinterProfileDto>;

public sealed class UpdatePrinterProfileValidator : AbstractValidator<UpdatePrinterProfileCommand>
{
    public UpdatePrinterProfileValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
}

public sealed record DeletePrinterProfileCommand(Guid Id) : ICommand;
