using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.TaxRates.Commands;

public sealed record UpsertTaxRateCommand(
    Guid?   Id,
    string  Name,
    string  Code,
    decimal Rate,
    string  AppliesTo,
    string? Description,
    bool    IsDefault,
    bool    IsActive
) : ICommand<TaxRateDto>;

public sealed class UpsertTaxRateCommandHandler(ITaxRateRepository repo, IUnitOfWork uow)
    : ICommandHandler<UpsertTaxRateCommand, TaxRateDto>
{
    public async Task<Result<TaxRateDto>> Handle(UpsertTaxRateCommand cmd, CancellationToken ct)
    {
        if (await repo.CodeExistsAsync(cmd.Code, cmd.Id, ct))
            return Result.Failure<TaxRateDto>(
                Error.Custom("TaxRate.CodeTaken", $"Tax code '{cmd.Code}' is already in use."));

        TaxRate taxRate;

        if (cmd.Id is null)
        {
            var result = TaxRate.Create(cmd.Name, cmd.Code, cmd.Rate, cmd.AppliesTo,
                cmd.Description, cmd.IsDefault, cmd.IsActive);
            if (result.IsFailure) return Result.Failure<TaxRateDto>(result.Error);
            taxRate = result.Value;
            taxRate.CreatedAt = DateTime.UtcNow;
            taxRate.CreatedBy = "system";
            repo.Add(taxRate);
        }
        else
        {
            taxRate = await repo.GetByIdAsync(cmd.Id.Value, ct)
                ?? throw new InvalidOperationException($"TaxRate {cmd.Id} not found.");
            taxRate.Update(cmd.Name, cmd.Code, cmd.Rate, cmd.AppliesTo,
                cmd.Description, cmd.IsDefault, cmd.IsActive);
        }

        await uow.SaveChangesAsync(ct);

        return Result.Success(new TaxRateDto(
            taxRate.Id, taxRate.Name, taxRate.Code, taxRate.Rate, taxRate.AppliesTo,
            taxRate.Description, taxRate.IsDefault, taxRate.IsActive, taxRate.IsSystem,
            taxRate.CreatedAt, taxRate.UpdatedAt));
    }
}
