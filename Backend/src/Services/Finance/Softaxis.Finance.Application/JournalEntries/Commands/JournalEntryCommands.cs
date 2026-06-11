using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.JournalEntries.Dtos;

namespace Softaxis.Finance.Application.JournalEntries.Commands;

public sealed record CreateJournalEntryCommand(
    string Date, string Description, string? Reference, string? Notes,
    IReadOnlyList<LineRequest> Lines) : ICommand<JournalEntryDto>;

public sealed class CreateJournalEntryValidator : AbstractValidator<CreateJournalEntryCommand>
{
    public CreateJournalEntryValidator()
    {
        RuleFor(x => x.Date).NotEmpty();
        RuleFor(x => x.Description).NotEmpty();
    }
}

public sealed record PostJournalEntryCommand(Guid Id) : ICommand;

public sealed record VoidJournalEntryCommand(Guid Id) : ICommand;

public sealed record DeleteJournalEntryCommand(Guid Id) : ICommand;
