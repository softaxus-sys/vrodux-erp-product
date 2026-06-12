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
        RuleFor(x => x.Lines).Must(l => l.Count >= 2)
            .WithMessage("A journal entry requires at least two lines.");

        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l)
                .Must(l => l.DebitAmount > 0 ^ l.CreditAmount > 0)
                .WithMessage("Each journal line must have either a debit or a credit amount, not both or neither.");
        });

        RuleFor(x => x.Lines)
            .Must(l => l.Sum(x => x.DebitAmount) == l.Sum(x => x.CreditAmount))
            .WithMessage("Total debits must equal total credits.");
    }
}

public sealed record PostJournalEntryCommand(Guid Id) : ICommand;

public sealed record VoidJournalEntryCommand(Guid Id) : ICommand;

public sealed record DeleteJournalEntryCommand(Guid Id) : ICommand;
