using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringExpenses.Commands;
using Softaxis.Finance.Application.RecurringExpenses.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.Expenses;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringExpenses;

internal sealed class CreateRecurringExpenseHandler(FinanceDbContext db)
    : ICommandHandler<CreateRecurringExpenseCommand, RecurringExpenseDto>
{
    public async Task<Result<RecurringExpenseDto>> Handle(CreateRecurringExpenseCommand cmd, CancellationToken ct)
    {
        if (await ExpensePosting.ValidateAccountsAsync(db, cmd.ExpenseAccountId, cmd.PaymentAccountId, ct) is { } problem)
            return Result.Failure<RecurringExpenseDto>(Error.Custom("RecurringExpense.Conflict", problem));

        var r = new RecurringExpense(
            cmd.TemplateName, cmd.Category, cmd.Amount, cmd.Vendor, cmd.PaymentMethod, cmd.Frequency,
            DateTime.Parse(cmd.StartDate), RecurringExpenseMappings.ParseNullableDate(cmd.EndDate),
            cmd.AutoPost, cmd.Reference, cmd.Notes);
        r.SetPostingAccounts(cmd.ExpenseAccountId, cmd.PaymentAccountId);

        db.RecurringExpenses.Add(r);
        await db.SaveChangesAsync(ct);

        return Result.Success(RecurringExpenseMappings.ToDto(r));
    }
}

internal sealed class UpdateRecurringExpenseHandler(FinanceDbContext db)
    : ICommandHandler<UpdateRecurringExpenseCommand>
{
    public async Task<Result> Handle(UpdateRecurringExpenseCommand cmd, CancellationToken ct)
    {
        var r = await db.RecurringExpenses.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (r is null)
            return Result.Failure(Error.NotFoundById("RecurringExpense", cmd.Id));

        if (await ExpensePosting.ValidateAccountsAsync(db, cmd.ExpenseAccountId, cmd.PaymentAccountId, ct) is { } problem)
            return Result.Failure(Error.Custom("RecurringExpense.Conflict", problem));

        r.Update(cmd.TemplateName, cmd.Category, cmd.Amount, cmd.Vendor, cmd.PaymentMethod, cmd.Frequency,
            RecurringExpenseMappings.ParseNullableDate(cmd.NextRunDate),
            RecurringExpenseMappings.ParseNullableDate(cmd.EndDate),
            cmd.AutoPost, cmd.Reference, cmd.Notes);
        r.SetPostingAccounts(cmd.ExpenseAccountId, cmd.PaymentAccountId);

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class PauseRecurringExpenseHandler(FinanceDbContext db)
    : ICommandHandler<PauseRecurringExpenseCommand>
{
    public async Task<Result> Handle(PauseRecurringExpenseCommand cmd, CancellationToken ct)
    {
        var r = await db.RecurringExpenses.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (r is null)
            return Result.Failure(Error.NotFoundById("RecurringExpense", cmd.Id));

        r.Pause();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class ResumeRecurringExpenseHandler(FinanceDbContext db)
    : ICommandHandler<ResumeRecurringExpenseCommand>
{
    public async Task<Result> Handle(ResumeRecurringExpenseCommand cmd, CancellationToken ct)
    {
        var r = await db.RecurringExpenses.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (r is null)
            return Result.Failure(Error.NotFoundById("RecurringExpense", cmd.Id));

        // A template that ran past its end date switched itself off; resuming it would do nothing
        // and look like it worked.
        if (r.EndDate is not null && r.NextRunDate.Date > r.EndDate.Value.Date)
            return Result.Failure(Error.Custom("RecurringExpense.Conflict",
                "This recurring expense has passed its end date. Extend or clear the end date first."));

        r.Resume();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DeleteRecurringExpenseHandler(FinanceDbContext db)
    : ICommandHandler<DeleteRecurringExpenseCommand>
{
    public async Task<Result> Handle(DeleteRecurringExpenseCommand cmd, CancellationToken ct)
    {
        var r = await db.RecurringExpenses.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (r is null)
            return Result.Failure(Error.NotFoundById("RecurringExpense", cmd.Id));

        // Soft delete: the expenses it already generated keep pointing at it.
        r.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
