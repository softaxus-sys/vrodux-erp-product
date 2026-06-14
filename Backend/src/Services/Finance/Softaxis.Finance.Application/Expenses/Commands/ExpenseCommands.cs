using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Expenses.Dtos;

namespace Softaxis.Finance.Application.Expenses.Commands;

public sealed record CreateExpenseCommand(
    string Title, string Category, decimal Amount, string ExpenseDate,
    string? PaidBy, string? PaymentMethod, string? Reference, string? Notes) : ICommand<ExpenseDto>;

public sealed class CreateExpenseValidator : AbstractValidator<CreateExpenseCommand>
{
    public CreateExpenseValidator()
    {
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Category).NotEmpty();
        RuleFor(x => x.ExpenseDate).NotEmpty();
    }
}

public sealed record UpdateExpenseCommand(
    Guid Id, string Title, string Category, decimal Amount, string ExpenseDate,
    string? PaidBy, string? PaymentMethod, string? Reference, string? Notes) : ICommand;

public sealed class UpdateExpenseValidator : AbstractValidator<UpdateExpenseCommand>
{
    public UpdateExpenseValidator()
    {
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Category).NotEmpty();
        RuleFor(x => x.ExpenseDate).NotEmpty();
    }
}

public sealed record ApproveExpenseCommand(Guid Id, Guid ApproverId) : ICommand;

public sealed record RejectExpenseCommand(Guid Id, Guid ApproverId) : ICommand;

public sealed record MarkExpensePaidCommand(Guid Id) : ICommand;

public sealed record DeleteExpenseCommand(Guid Id) : ICommand;

public sealed record UploadExpenseReceiptCommand(
    Guid Id, byte[] Data, string FileName, string ContentType) : ICommand;

public sealed class UploadExpenseReceiptValidator : AbstractValidator<UploadExpenseReceiptCommand>
{
    private static readonly string[] Allowed =
        ["image/png", "image/jpeg", "image/webp", "application/pdf"];

    public UploadExpenseReceiptValidator()
    {
        RuleFor(x => x.Data).NotEmpty().WithMessage("Receipt file is empty.")
            .Must(d => d.Length <= 5 * 1024 * 1024).WithMessage("Receipt must be 5 MB or smaller.");
        RuleFor(x => x.FileName).NotEmpty();
        RuleFor(x => x.ContentType).Must(ct => Allowed.Contains(ct.ToLowerInvariant()))
            .WithMessage("Receipt must be a PNG, JPEG, WebP, or PDF file.");
    }
}

public sealed record DeleteExpenseReceiptCommand(Guid Id) : ICommand;
