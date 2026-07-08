using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.VisaServices.Application.VisaCases.Dtos;

namespace Softaxis.VisaServices.Application.VisaTypes.Commands;

public sealed record CreateVisaTypeCommand(
    string Name, string Category, string Channel, decimal DefaultGovtFee, decimal DefaultServiceFee,
    int ProcessingDays, IReadOnlyList<string> RequiredDocuments) : ICommand<VisaTypeDto>;

public sealed class CreateVisaTypeValidator : AbstractValidator<CreateVisaTypeCommand>
{
    public CreateVisaTypeValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Category).NotEmpty();
        RuleFor(x => x.Channel).NotEmpty();
        RuleFor(x => x.ProcessingDays).GreaterThanOrEqualTo(0);
    }
}

public sealed record UpdateVisaTypeCommand(
    Guid Id, string Name, string Category, string Channel, decimal DefaultGovtFee, decimal DefaultServiceFee,
    int ProcessingDays, IReadOnlyList<string> RequiredDocuments) : ICommand;

public sealed class UpdateVisaTypeValidator : AbstractValidator<UpdateVisaTypeCommand>
{
    public UpdateVisaTypeValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Category).NotEmpty();
        RuleFor(x => x.Channel).NotEmpty();
        RuleFor(x => x.ProcessingDays).GreaterThanOrEqualTo(0);
    }
}

public sealed record DeleteVisaTypeCommand(Guid Id) : ICommand;
