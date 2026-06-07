using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PaymentMethods.Commands.SavePaymentMethods;

public sealed class SavePaymentMethodsCommandHandler(
    IPaymentMethodConfigRepository repo,
    IUnitOfWork uow)
    : ICommandHandler<SavePaymentMethodsCommand, List<PaymentMethodConfigDto>>
{
    public async Task<Result<List<PaymentMethodConfigDto>>> Handle(
        SavePaymentMethodsCommand cmd, CancellationToken ct)
    {
        // Load all existing records (index by code for O(1) lookup)
        var existing = (await repo.GetAllAsync(ct))
            .ToDictionary(m => m.Code, StringComparer.OrdinalIgnoreCase);

        foreach (var item in cmd.Items)
        {
            if (existing.TryGetValue(item.Code, out var record))
            {
                // Update existing record
                record.SetEnabled(item.IsEnabled);
                record.SetSortOrder(item.SortOrder);
                if (!record.IsSystem)
                    record.Rename(item.Label);   // allow renaming custom methods
            }
            else if (item.IsCustom)
            {
                // New custom method — create and add
                var result = PaymentMethodConfig.CreateCustom(item.Label, item.SortOrder);
                if (result.IsFailure)
                    return Result.Failure<List<PaymentMethodConfigDto>>(result.Error);

                var newMethod = result.Value;
                // Override the auto-generated code with the one sent by client
                // (client uses stable custom_xxx IDs for correlation)
                repo.Add(newMethod);
                existing[newMethod.Code] = newMethod;
            }
            // Unknown non-custom codes are silently skipped
        }

        await uow.SaveChangesAsync(ct);

        // Return updated full list
        var all = await repo.GetAllAsync(ct);
        var dtos = all
            .OrderBy(m => m.SortOrder)
            .ThenBy(m => m.Code)
            .Select(m => new PaymentMethodConfigDto(
                m.Id, m.Code, m.Label, m.IconKey,
                m.Countries, m.Description,
                m.SortOrder, m.IsEnabled, m.IsSystem))
            .ToList();

        return Result.Success(dtos);
    }
}
