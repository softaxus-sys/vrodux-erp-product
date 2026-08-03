using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.PublicOrdering.Dtos;

namespace Softaxis.Restaurant.Application.PublicOrdering.Commands;

/// <summary>
/// POST /api/restaurant/public-orders — anonymous. Tenant resolved from the table's QrCode (mirrors
/// the webhook/Careers anonymous-endpoint pattern). Channel distinguishes a guest scanning a table's
/// code ("qr_table", default) from an unattended self-ordering kiosk device ("kiosk") — both land as a
/// normal dine-in Order at the given table; kiosks are modelled as a table row too (e.g. "Kiosk 1"),
/// not a separate identity system.
/// </summary>
public sealed record PlacePublicOrderCommand(
    string QrCode, string? Channel, string? Notes, string GuestDeviceToken, IReadOnlyList<PublicOrderLineInput> Items
) : ICommand<PublicOrderPlacedDto>;

public sealed class PlacePublicOrderValidator : AbstractValidator<PlacePublicOrderCommand>
{
    public PlacePublicOrderValidator()
    {
        RuleFor(x => x.QrCode).NotEmpty();
        RuleFor(x => x.GuestDeviceToken).NotEmpty();
        RuleFor(x => x.Items).NotEmpty().WithMessage("Add at least one item.");
        RuleForEach(x => x.Items).ChildRules(i => i.RuleFor(l => l.Quantity).GreaterThan(0));
    }
}
