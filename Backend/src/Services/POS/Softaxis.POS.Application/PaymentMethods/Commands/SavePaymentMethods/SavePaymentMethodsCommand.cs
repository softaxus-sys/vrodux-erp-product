using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.PaymentMethods.Commands.SavePaymentMethods;

/// <summary>
/// Bulk-updates payment method configuration from the settings page.
/// - For existing system methods: updates IsEnabled + SortOrder.
/// - For items with IsCustom=true and unknown Code: creates a new custom record.
/// - System methods are never deleted by this command.
/// </summary>
public sealed record SavePaymentMethodsCommand(
    IReadOnlyList<PaymentMethodSaveItem> Items
) : ICommand<List<PaymentMethodConfigDto>>;

public sealed record PaymentMethodSaveItem(
    string  Code,
    string  Label,
    bool    IsEnabled,
    int     SortOrder,
    bool    IsCustom
);
