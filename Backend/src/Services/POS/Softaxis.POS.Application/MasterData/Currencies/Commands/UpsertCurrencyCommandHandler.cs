using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.Currencies.Commands;

/// <summary>Id == null → create; Id set → update.</summary>
public sealed record UpsertCurrencyCommand(
    Guid?   Id,
    string  Code,
    string  Name,
    string  Symbol,
    decimal ExchangeRate,
    bool    IsDefault,
    bool    IsActive
) : ICommand<CurrencyDto>;

public sealed class UpsertCurrencyCommandHandler(
    ICurrencyRepository repo, IUnitOfWork uow)
    : ICommandHandler<UpsertCurrencyCommand, CurrencyDto>
{
    public async Task<Result<CurrencyDto>> Handle(UpsertCurrencyCommand cmd, CancellationToken ct)
    {
        // Code uniqueness check
        if (await repo.CodeExistsAsync(cmd.Code, cmd.Id, ct))
            return Result.Failure<CurrencyDto>(
                Error.Custom("Currency.CodeTaken", $"Currency code '{cmd.Code}' is already in use."));

        Currency currency;

        if (cmd.Id is null)
        {
            // ── Create ────────────────────────────────────────────────────────
            var result = Currency.Create(
                cmd.Code, cmd.Name, cmd.Symbol,
                cmd.ExchangeRate, cmd.IsDefault, cmd.IsActive);

            if (result.IsFailure) return Result.Failure<CurrencyDto>(result.Error);

            currency = result.Value;
            currency.CreatedAt = DateTime.UtcNow;
            currency.CreatedBy = "system";
            repo.Add(currency);
        }
        else
        {
            // ── Update ────────────────────────────────────────────────────────
            currency = await repo.GetByIdAsync(cmd.Id.Value, ct)
                ?? throw new InvalidOperationException($"Currency {cmd.Id} not found.");

            currency.Update(cmd.Code, cmd.Name, cmd.Symbol,
                cmd.ExchangeRate, cmd.IsDefault, cmd.IsActive);
        }

        await uow.SaveChangesAsync(ct);

        return Result.Success(new CurrencyDto(
            currency.Id, currency.Code, currency.Name, currency.Symbol,
            currency.ExchangeRate, currency.IsDefault, currency.IsActive, currency.IsSystem,
            currency.CreatedAt, currency.UpdatedAt));
    }
}
