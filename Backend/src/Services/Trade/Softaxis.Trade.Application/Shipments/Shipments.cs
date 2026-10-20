using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Trade.Domain.Entities;

namespace Softaxis.Trade.Application.Shipments;

public sealed record Paged<T>(IReadOnlyList<T> Items, int Total);

// ── Input ───────────────────────────────────────────────────────────────────

public sealed record ItemInput(
    string Description, string? HsCode, string? OriginCountry, decimal Quantity, string? Unit, decimal UnitPrice,
    decimal? WeightKg, decimal? VolumeCbm, int? Packages, Guid? ProductId, string? Sku);

public sealed record ContainerInput(string Number, string? Type, string? SealNumber, decimal? GrossWeightKg);

/// <summary>
/// Everything on a shipment's header, plus its goods and containers. Create and edit share it;
/// <c>Direction</c> is fixed at creation and ignored when editing.
/// </summary>
public sealed record ShipmentInput(
    string Direction, string Mode, Guid? PartnerId, Guid? ForwarderId, Guid? AgentId, string? OrderReference,
    string? Incoterm, string? BlNumber, string? CarrierName, string? VesselOrFlight,
    string? OriginCountry, string? OriginPort, string? DestinationCountry, string? DestinationPort,
    DateOnly? Etd, DateOnly? Eta, int? FreeDays, string Currency, decimal ExchangeRate, string? Notes,
    IReadOnlyList<ItemInput> Items, IReadOnlyList<ContainerInput> Containers,
    string? LinkedOrderType = null, Guid? LinkedOrderId = null);

public sealed record CostInput(
    string Type, string? Description, decimal Amount, string? Basis, string? VendorName,
    string? InvoiceReference, DateOnly? PaidOn);

public sealed record PaymentInput(
    string Kind, decimal Amount, DateOnly? DueDate, DateOnly? PaidOn, string? Reference,
    string? LcNumber, string? BankName, DateOnly? LcExpiry, string? Notes);

public sealed record DocumentInput(
    string Type, string? Number, DateOnly? IssueDate, DateOnly? ExpiryDate, string? Notes,
    string? FileName, string? ContentType, string? ContentBase64);

// ── Output ──────────────────────────────────────────────────────────────────

public sealed record ShipmentSummaryDto(
    Guid Id, string ShipmentNumber, string Direction, string Status, string Mode, Guid? PartnerId, string? PartnerName,
    string? OrderReference, string? Incoterm, string? BlNumber, string? OriginCountry, string? OriginPort,
    string? DestinationCountry, string? DestinationPort, DateOnly? Etd, DateOnly? Eta, DateOnly? FreeTimeEnds,
    string Currency, decimal GoodsValue, int ItemCount, int ContainerCount, DateTime CreatedAt);

public sealed record ItemDto(
    Guid Id, string Description, string? HsCode, string? OriginCountry, decimal Quantity, string Unit, decimal UnitPrice,
    decimal LineValue, decimal? WeightKg, decimal? VolumeCbm, int? Packages, Guid? ProductId, string? Sku,
    // Landed cost — null when the caller may not see costs.
    decimal? GoodsValueBase, decimal? AllocatedCost, decimal? LandedTotal, decimal? LandedUnitCost);

public sealed record ContainerDto(Guid Id, string Number, string? Type, string? SealNumber, decimal? GrossWeightKg);

public sealed record MilestoneDto(Guid Id, string Status, DateOnly OccurredOn, string? Note, string? RecordedBy, DateTime RecordedAt);

public sealed record CostDto(
    Guid Id, string Type, string? Description, decimal Amount, string Basis, string? VendorName,
    string? InvoiceReference, DateOnly? PaidOn);

public sealed record PaymentDto(
    Guid Id, string Kind, decimal Amount, DateOnly? DueDate, DateOnly? PaidOn, string Status, string? Reference,
    string? LcNumber, string? BankName, DateOnly? LcExpiry, string? Notes);

public sealed record DocumentDto(
    Guid Id, Guid ShipmentId, string? ShipmentNumber, string Type, string? Number, DateOnly? IssueDate,
    DateOnly? ExpiryDate, string? Notes, string? FileName, string? ContentType, long SizeBytes, bool HasFile, DateTime CreatedAt);

public sealed record FileDto(string FileName, string ContentType, byte[] Content);

/// <param name="Costs">Null when the caller lacks <c>trade.costs.view</c> — cost and margin figures are not for everyone.</param>
/// <param name="Payments">Null when the caller lacks <c>trade.payments.view</c>.</param>
public sealed record ShipmentDto(
    Guid Id, string ShipmentNumber, string Direction, string Status, string Mode,
    Guid? PartnerId, string? PartnerName, Guid? ForwarderId, string? ForwarderName, Guid? AgentId, string? AgentName,
    string? OrderReference, string? Incoterm, string? BlNumber, string? CarrierName, string? VesselOrFlight,
    string? OriginCountry, string? OriginPort, string? DestinationCountry, string? DestinationPort,
    DateOnly? Etd, DateOnly? Eta, DateOnly? DepartedOn, DateOnly? ArrivedOn, DateOnly? ClearedOn, DateOnly? DeliveredOn,
    int? FreeDays, DateOnly? FreeTimeEnds, string Currency, decimal ExchangeRate, string? Notes,
    string? LinkedOrderType, Guid? LinkedOrderId,
    decimal GoodsValue, decimal GoodsValueBase, decimal? TotalCosts, decimal? LandedTotal,
    decimal? PaymentsPaid, decimal? PaymentsPending,
    IReadOnlyList<ItemDto> Items, IReadOnlyList<ContainerDto> Containers, IReadOnlyList<MilestoneDto> Milestones,
    IReadOnlyList<CostDto>? Costs, IReadOnlyList<PaymentDto>? Payments, IReadOnlyList<DocumentDto> Documents,
    DateTime CreatedAt, DateTime? UpdatedAt);

// ── Queries / commands ──────────────────────────────────────────────────────

public sealed record GetShipmentsQuery(
    string? Search = null, string? Direction = null, string? Status = null, Guid? PartnerId = null,
    bool OpenOnly = false, int Page = 1, int PageSize = 25) : IQuery<Paged<ShipmentSummaryDto>>;

public sealed record GetShipmentByIdQuery(Guid Id) : IQuery<ShipmentDto>;

public sealed record CreateShipmentCommand(ShipmentInput Input, DateOnly? Today = null) : ICommand<ShipmentDto>;
public sealed record UpdateShipmentCommand(Guid Id, ShipmentInput Input) : ICommand<ShipmentDto>;

public sealed record ChangeShipmentStatusCommand(Guid Id, string Status, DateOnly? Date, string? Note) : ICommand<ShipmentDto>;

public sealed record DeleteShipmentCommand(Guid Id) : ICommand;

public sealed record AddShipmentCostCommand(Guid ShipmentId, CostInput Cost) : ICommand<ShipmentDto>;
public sealed record UpdateShipmentCostCommand(Guid ShipmentId, Guid CostId, CostInput Cost) : ICommand<ShipmentDto>;
public sealed record RemoveShipmentCostCommand(Guid ShipmentId, Guid CostId) : ICommand<ShipmentDto>;

public sealed record AddShipmentPaymentCommand(Guid ShipmentId, PaymentInput Payment) : ICommand<ShipmentDto>;
public sealed record UpdateShipmentPaymentCommand(Guid ShipmentId, Guid PaymentId, PaymentInput Payment) : ICommand<ShipmentDto>;
public sealed record RemoveShipmentPaymentCommand(Guid ShipmentId, Guid PaymentId) : ICommand<ShipmentDto>;

public sealed record AddDocumentCommand(Guid ShipmentId, DocumentInput Document) : ICommand<DocumentDto>;
public sealed record UpdateDocumentCommand(Guid Id, DocumentInput Document) : ICommand<DocumentDto>;
public sealed record DeleteDocumentCommand(Guid Id) : ICommand;
public sealed record GetDocumentFileQuery(Guid Id) : IQuery<FileDto>;

// ── Validation ──────────────────────────────────────────────────────────────

public static class TradeRules
{
    public const int MaxItems = 500, MaxContainers = 200, MaxDocumentBytes = 8 * 1024 * 1024;

    public static readonly string[] Incoterms = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
}

public sealed class ShipmentInputValidator : AbstractValidator<ShipmentInput>
{
    public ShipmentInputValidator()
    {
        RuleFor(x => x.Direction).Must(d => d is ShipmentDirection.Import or ShipmentDirection.Export)
            .WithMessage("Direction must be import or export.");
        RuleFor(x => x.Mode).Must(m => ShipmentMode.All.Contains(m)).WithMessage("Choose a valid transport mode.");
        RuleFor(x => x.Incoterm).Must(i => TradeRules.Incoterms.Contains(i!.Trim().ToUpperInvariant()))
            .When(x => !string.IsNullOrWhiteSpace(x.Incoterm)).WithMessage("Choose a valid Incoterm.");
        RuleFor(x => x.OrderReference).MaximumLength(100);
        RuleFor(x => x.LinkedOrderType).Must(t => t is "purchase" or "sales")
            .When(x => !string.IsNullOrWhiteSpace(x.LinkedOrderType)).WithMessage("A linked order must be a purchase or sales order.");
        RuleFor(x => x.BlNumber).MaximumLength(100);
        RuleFor(x => x.CarrierName).MaximumLength(200);
        RuleFor(x => x.VesselOrFlight).MaximumLength(200);
        RuleFor(x => x.OriginCountry).MaximumLength(100);
        RuleFor(x => x.OriginPort).MaximumLength(150);
        RuleFor(x => x.DestinationCountry).MaximumLength(100);
        RuleFor(x => x.DestinationPort).MaximumLength(150);
        RuleFor(x => x.Notes).MaximumLength(4000);
        RuleFor(x => x.FreeDays).InclusiveBetween(0, 365).When(x => x.FreeDays.HasValue);
        RuleFor(x => x.Currency).NotEmpty().Length(3).WithMessage("Currency must be a 3-letter code.");
        RuleFor(x => x.ExchangeRate).GreaterThan(0).WithMessage("Exchange rate must be above zero.");
        RuleFor(x => x).Must(x => x.Eta is null || x.Etd is null || x.Eta >= x.Etd)
            .WithMessage("The expected arrival cannot be before the expected departure.");
        RuleFor(x => x.Items).NotNull().Must(i => i.Count <= TradeRules.MaxItems)
            .WithMessage($"At most {TradeRules.MaxItems} lines per shipment.");
        RuleFor(x => x.Containers).NotNull().Must(c => c.Count <= TradeRules.MaxContainers)
            .WithMessage($"At most {TradeRules.MaxContainers} containers per shipment.");
        RuleForEach(x => x.Items).ChildRules(i =>
        {
            i.RuleFor(v => v.Description).NotEmpty().WithMessage("Every line needs a description.").MaximumLength(400);
            i.RuleFor(v => v.HsCode).MaximumLength(20);
            i.RuleFor(v => v.Quantity).GreaterThan(0).WithMessage("Quantity must be above zero.");
            i.RuleFor(v => v.UnitPrice).GreaterThanOrEqualTo(0);
            i.RuleFor(v => v.WeightKg).GreaterThanOrEqualTo(0).When(v => v.WeightKg.HasValue);
            i.RuleFor(v => v.VolumeCbm).GreaterThanOrEqualTo(0).When(v => v.VolumeCbm.HasValue);
        });
        RuleForEach(x => x.Containers).ChildRules(c =>
        {
            c.RuleFor(v => v.Number).NotEmpty().WithMessage("Every container needs a number.").MaximumLength(30);
            c.RuleFor(v => v.Type).MaximumLength(20);
            c.RuleFor(v => v.SealNumber).MaximumLength(40);
        });
    }
}

public sealed class CreateShipmentValidator : AbstractValidator<CreateShipmentCommand>
{
    public CreateShipmentValidator() => RuleFor(x => x.Input).SetValidator(new ShipmentInputValidator());
}

public sealed class UpdateShipmentValidator : AbstractValidator<UpdateShipmentCommand>
{
    public UpdateShipmentValidator() => RuleFor(x => x.Input).SetValidator(new ShipmentInputValidator());
}

public sealed class ChangeShipmentStatusValidator : AbstractValidator<ChangeShipmentStatusCommand>
{
    public ChangeShipmentStatusValidator()
    {
        RuleFor(x => x.Status).Must(s => ShipmentStatus.Journey.Contains(s) || s == ShipmentStatus.Cancelled)
            .WithMessage("Unknown status.");
        RuleFor(x => x.Note).MaximumLength(500);
        // A status records something that already happened. One day of slack covers a caller
        // who is ahead of the server's UTC clock.
        RuleFor(x => x.Date).Must(d => d is null || d.Value <= DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1))
            .WithMessage("The date cannot be in the future.");
    }
}

public sealed class CostInputValidator : AbstractValidator<CostInput>
{
    public CostInputValidator()
    {
        RuleFor(x => x.Type).Must(t => CostType.All.Contains(t)).WithMessage("Choose a valid cost type.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be above zero.");
        RuleFor(x => x.Basis).Must(b => AllocationBasis.All.Contains(b!))
            .When(x => !string.IsNullOrWhiteSpace(x.Basis)).WithMessage("Choose a valid way to share the cost.");
        RuleFor(x => x.Description).MaximumLength(300);
        RuleFor(x => x.VendorName).MaximumLength(200);
        RuleFor(x => x.InvoiceReference).MaximumLength(100);
    }
}

public sealed class AddShipmentCostValidator : AbstractValidator<AddShipmentCostCommand>
{
    public AddShipmentCostValidator() => RuleFor(x => x.Cost).SetValidator(new CostInputValidator());
}

public sealed class UpdateShipmentCostValidator : AbstractValidator<UpdateShipmentCostCommand>
{
    public UpdateShipmentCostValidator() => RuleFor(x => x.Cost).SetValidator(new CostInputValidator());
}

public sealed class PaymentInputValidator : AbstractValidator<PaymentInput>
{
    public PaymentInputValidator()
    {
        RuleFor(x => x.Kind).Must(k => PaymentKind.All.Contains(k)).WithMessage("Choose a valid payment type.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be above zero.");
        RuleFor(x => x.Reference).MaximumLength(100);
        RuleFor(x => x.LcNumber).MaximumLength(60);
        RuleFor(x => x.BankName).MaximumLength(200);
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}

public sealed class AddShipmentPaymentValidator : AbstractValidator<AddShipmentPaymentCommand>
{
    public AddShipmentPaymentValidator() => RuleFor(x => x.Payment).SetValidator(new PaymentInputValidator());
}

public sealed class UpdateShipmentPaymentValidator : AbstractValidator<UpdateShipmentPaymentCommand>
{
    public UpdateShipmentPaymentValidator() => RuleFor(x => x.Payment).SetValidator(new PaymentInputValidator());
}

public sealed class DocumentInputValidator : AbstractValidator<DocumentInput>
{
    public DocumentInputValidator()
    {
        RuleFor(x => x.Type).Must(t => DocumentType.All.Contains(t)).WithMessage("Choose a valid document type.");
        RuleFor(x => x.Number).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(1000);
        RuleFor(x => x.FileName).MaximumLength(260);
        RuleFor(x => x.ContentType).MaximumLength(150);
        RuleFor(x => x).Must(x => x.IssueDate is null || x.ExpiryDate is null || x.ExpiryDate >= x.IssueDate)
            .WithMessage("The expiry date cannot be before the issue date.");
    }
}

public sealed class AddDocumentValidator : AbstractValidator<AddDocumentCommand>
{
    public AddDocumentValidator() => RuleFor(x => x.Document).SetValidator(new DocumentInputValidator());
}

public sealed class UpdateDocumentValidator : AbstractValidator<UpdateDocumentCommand>
{
    public UpdateDocumentValidator() => RuleFor(x => x.Document).SetValidator(new DocumentInputValidator());
}
