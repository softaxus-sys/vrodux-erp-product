using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.Fbr;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Settings;

// ─────────────────────────────────────────────────────────────────────────────
//  Settings > FBR Integration
// ─────────────────────────────────────────────────────────────────────────────

public sealed record FbrQueueItemDto(
    Guid Id, string TransactionNumber, DateTime CompletedAt, decimal TotalAmount,
    string Status, int Attempts, string? LastError, DateTime? NextAttemptAt);

/// <summary>The token itself is never returned - only whether one is stored.</summary>
public sealed record FbrSettingsDto(
    bool    Enabled,
    string  Environment,
    long?   PosId,
    bool    HasToken,
    decimal ServiceFee,
    string? DefaultPctCode,
    int     Pending,
    int     Submitted,
    int     Failed,
    IReadOnlyList<FbrQueueItemDto> Unsubmitted);

public sealed record GetFbrSettingsQuery : IQuery<FbrSettingsDto>;

/// <param name="Token">New FBR token, or null/empty to keep the stored one.</param>
public sealed record SaveFbrSettingsCommand(
    bool    Enabled,
    string  Environment,
    long?   PosId,
    string? Token,
    decimal ServiceFee,
    string? DefaultPctCode) : ICommand<FbrSettingsDto>;

public sealed class SaveFbrSettingsValidator : AbstractValidator<SaveFbrSettingsCommand>
{
    public SaveFbrSettingsValidator()
    {
        RuleFor(x => x.Environment).Must(e => e is "sandbox" or "production")
            .WithMessage("Environment must be sandbox or production.");
        RuleFor(x => x.PosId).NotNull().GreaterThan(0).When(x => x.Enabled)
            .WithMessage("Enter the POS ID issued by FBR.");
        RuleFor(x => x.ServiceFee).InclusiveBetween(0, 100);
        RuleFor(x => x.DefaultPctCode).Matches(@"^[0-9.]{4,20}$").When(x => !string.IsNullOrWhiteSpace(x.DefaultPctCode))
            .WithMessage("PCT code should be digits, e.g. 2106.9090.");
        RuleFor(x => x.Token).MaximumLength(3000);
    }
}

public sealed record FbrTestResultDto(bool Success, string Message, string? FbrInvoiceNumber);

/// <summary>Sends a Rs 1 dummy invoice - sandbox only, so it can never create a real tax record.</summary>
public sealed record TestFbrConnectionCommand : ICommand<FbrTestResultDto>;

/// <summary>Re-queue one failed sale, or all failed sales when TransactionId is null.</summary>
public sealed record RetryFbrCommand(Guid? TransactionId) : ICommand<int>;

internal static class FbrSettingsAccess
{
    /// <summary>Same supervisor-level key as the other POS settings.</summary>
    public const string Permission = "pos.sessions.approve";
}

public sealed class GetFbrSettingsQueryHandler(IPosSettingsRepository settingsRepo, IPOSTransactionRepository txnRepo)
    : IQueryHandler<GetFbrSettingsQuery, FbrSettingsDto>
{
    public async Task<Result<FbrSettingsDto>> Handle(GetFbrSettingsQuery q, CancellationToken ct)
        => Result.Success(await FbrSettingsMapper.BuildAsync(await settingsRepo.GetAsync(ct), txnRepo, ct));
}

internal static class FbrSettingsMapper
{
    public static async Task<FbrSettingsDto> BuildAsync(PosSettings? s, IPOSTransactionRepository txnRepo, CancellationToken ct)
    {
        var counts = await txnRepo.GetFbrStatusCountsAsync(ct);
        var queue  = await txnRepo.GetFbrUnsubmittedAsync(20, ct);
        return new FbrSettingsDto(
            s?.FbrEnabled ?? false,
            s?.FbrEnvironment ?? "sandbox",
            s?.FbrPosId,
            !string.IsNullOrEmpty(s?.FbrTokenProtected),
            s?.FbrServiceFee ?? 1m,
            s?.FbrDefaultPctCode,
            counts.GetValueOrDefault("pending"),
            counts.GetValueOrDefault("submitted"),
            counts.GetValueOrDefault("failed"),
            queue.Select(t => new FbrQueueItemDto(t.Id, t.TransactionNumber, t.CompletedAt, t.TotalAmount,
                t.FbrStatus!, t.FbrAttempts, t.FbrLastError, t.FbrNextAttemptAt)).ToList());
    }
}

public sealed class SaveFbrSettingsCommandHandler(
    IPosSettingsRepository    settingsRepo,
    IPOSTransactionRepository txnRepo,
    ISecretProtector          protector,
    ICurrentUser              currentUser,
    IUnitOfWork               uow)
    : ICommandHandler<SaveFbrSettingsCommand, FbrSettingsDto>
{
    public async Task<Result<FbrSettingsDto>> Handle(SaveFbrSettingsCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission(FbrSettingsAccess.Permission))
            return Result.Failure<FbrSettingsDto>(Error.Custom("PosSettings.Forbidden",
                "Only a POS supervisor or administrator can change FBR settings."));

        var settings = await settingsRepo.GetAsync(ct);
        if (settings is null)
        {
            settings = PosSettings.CreateDefault();
            settings.CreatedAt = DateTime.UtcNow;
            settings.CreatedBy = currentUser.Username ?? "system";
            settingsRepo.Add(settings);
        }

        var newToken = string.IsNullOrWhiteSpace(cmd.Token) ? null : protector.Protect(cmd.Token.Trim());

        if (cmd.Enabled && newToken is null && string.IsNullOrEmpty(settings.FbrTokenProtected))
            return Result.Failure<FbrSettingsDto>(Error.Custom("Validation.Failed",
                "Enter the FBR API token before enabling the integration."));

        settings.SetFbr(cmd.Enabled, cmd.Environment, cmd.PosId, newToken, cmd.ServiceFee, cmd.DefaultPctCode);
        settings.UpdatedAt = DateTime.UtcNow;
        settings.UpdatedBy = currentUser.Username;
        await uow.SaveChangesAsync(ct);

        return Result.Success(await FbrSettingsMapper.BuildAsync(settings, txnRepo, ct));
    }
}

public sealed class TestFbrConnectionCommandHandler(
    IPosSettingsRepository settingsRepo,
    IFbrClient             client,
    ISecretProtector       protector,
    ICurrentUser           currentUser)
    : ICommandHandler<TestFbrConnectionCommand, FbrTestResultDto>
{
    public async Task<Result<FbrTestResultDto>> Handle(TestFbrConnectionCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission(FbrSettingsAccess.Permission))
            return Result.Failure<FbrTestResultDto>(Error.Custom("PosSettings.Forbidden",
                "Only a POS supervisor or administrator can test the FBR connection."));

        var s = await settingsRepo.GetAsync(ct);
        if (s?.FbrPosId is not > 0 || string.IsNullOrEmpty(s.FbrTokenProtected))
            return Result.Success(new FbrTestResultDto(false, "Save the POS ID and token first.", null));

        // A test invoice in production would be a real tax record - refuse outright.
        if (s.FbrEnvironment != "sandbox")
            return Result.Success(new FbrTestResultDto(false,
                "Test connection only runs in the SANDBOX environment. Switch to sandbox to test.", null));

        string? token;
        try { token = protector.Unprotect(s.FbrTokenProtected); } catch { token = null; }
        if (string.IsNullOrEmpty(token))
            return Result.Success(new FbrTestResultDto(false, "The stored token cannot be read - enter it again.", null));

        var now = DateTime.UtcNow.AddHours(5);
        var invoice = new FbrInvoice
        {
            POSID           = s.FbrPosId!.Value,
            USIN            = $"TEST-{now:yyyyMMddHHmmss}",
            DateTime        = now.ToString("yyyy-MM-dd HH:mm:ss"),
            BuyerName       = "Vrodux connection test",
            TotalBillAmount = 1m,
            TotalQuantity   = 1,
            TotalSaleValue  = 1m,
            PaymentMode     = 1,
            InvoiceType     = 1,
            Items =
            [
                new FbrInvoiceItem
                {
                    ItemCode = "TEST", ItemName = "Connection test", Quantity = 1,
                    PCTCode = string.IsNullOrWhiteSpace(s.FbrDefaultPctCode) ? "00000000" : s.FbrDefaultPctCode!,
                    SaleValue = 1m, TotalAmount = 1m, InvoiceType = 1,
                },
            ],
        };

        var r = await client.SubmitAsync(invoice, "sandbox", token, ct);
        return Result.Success(r.Success
            ? new FbrTestResultDto(true, $"Connected. FBR sandbox returned invoice number {r.InvoiceNumber}.", r.InvoiceNumber)
            : new FbrTestResultDto(false, r.Error ?? "FBR did not return an invoice number.", null));
    }
}

public sealed class RetryFbrCommandHandler(
    IPOSTransactionRepository txnRepo,
    ICurrentUser              currentUser,
    IUnitOfWork               uow)
    : ICommandHandler<RetryFbrCommand, int>
{
    public async Task<Result<int>> Handle(RetryFbrCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission(FbrSettingsAccess.Permission))
            return Result.Failure<int>(Error.Custom("PosSettings.Forbidden",
                "Only a POS supervisor or administrator can retry FBR submissions."));

        var targets = cmd.TransactionId is { } id
            ? (await txnRepo.GetByIdAsync(id, ct)) is { } one ? [one] : []
            : await txnRepo.GetFbrUnsubmittedAsync(500, ct);

        var n = 0;
        foreach (var t in targets.Where(t => t.FbrStatus is "failed" or "pending"))
        {
            t.RequeueFbr();
            txnRepo.Update(t);
            n++;
        }
        await uow.SaveChangesAsync(ct);
        return Result.Success(n);
    }
}
