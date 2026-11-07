using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Farming.Domain.Entities;

namespace Softaxis.Farming.Application;

/// <summary>Marker for MediatR/FluentValidation assembly scanning.</summary>
public static class AssemblyMarker;

public static class Dates
{
    public static bool Valid(string? s) =>
        DateOnly.TryParseExact(s, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None, out _);

    public static bool ValidOrEmpty(string? s) => string.IsNullOrWhiteSpace(s) || Valid(s);
}

/// <summary>The signed-in staff member, read from the JWT by the host.</summary>
public interface ICurrentUser
{
    Guid? Id { get; }
    string? Name { get; }
    bool IsSuperAdmin { get; }
    bool HasPermission(string permissionKey);
}

// ── Setup ───────────────────────────────────────────────────────────────────

public sealed record FarmSettingsDto(IReadOnlyList<string> EnabledTypes, string MilkUnit);
public sealed record GetFarmSettingsQuery : IQuery<FarmSettingsDto>;
public sealed record UpdateFarmSettingsCommand(IReadOnlyList<string> EnabledTypes, string? MilkUnit) : ICommand<FarmSettingsDto>;

public sealed record FarmDto(Guid Id, string Name, string? Location, decimal AreaAcres, string? Manager, string? Phone,
    string? Notes, int UnitCount);
public sealed record GetFarmsQuery : IQuery<IReadOnlyList<FarmDto>>;
public sealed record SaveFarmCommand(Guid? Id, string Name, string? Location, decimal AreaAcres, string? Manager,
    string? Phone, string? Notes) : ICommand<FarmDto>;
public sealed record DeleteFarmCommand(Guid Id) : ICommand;

public sealed record FarmUnitDto(Guid Id, Guid FarmId, string? FarmName, string Name, string Type, string Kind,
    decimal Capacity, string? Notes, bool IsActive, int HeadCount);
public sealed record GetUnitsQuery(Guid? FarmId, string? Type) : IQuery<IReadOnlyList<FarmUnitDto>>;
public sealed record SaveUnitCommand(Guid? Id, Guid FarmId, string Name, string Type, string Kind, decimal Capacity,
    string? Notes, bool IsActive) : ICommand<FarmUnitDto>;
public sealed record DeleteUnitCommand(Guid Id) : ICommand;

// ── Animals ─────────────────────────────────────────────────────────────────

public sealed record AnimalDto(Guid Id, string TagNumber, string? Name, string Type, string? Species, string? Breed,
    string Sex, string? BirthDate, Guid? UnitId, string? UnitName, Guid? DamId, string? DamTag, Guid? SireId,
    string? SireTag, string Source, string? AcquiredOn, decimal PurchasePrice, string Status, string? StatusDate,
    string? StatusReason, string? Notes, decimal? LastWeightKg, decimal Production30d, string? PregnantDueOn,
    string? WithdrawalUntil);

public sealed record GetAnimalsQuery(string? Type, string? Status, Guid? UnitId, string? Search, string? Today)
    : IQuery<IReadOnlyList<AnimalDto>>;

public sealed record AnimalDetailDto(AnimalDto Animal, IReadOnlyList<ProductionDto> Production,
    IReadOnlyList<HealthDto> Health, IReadOnlyList<BreedingDto> Breeding, IReadOnlyList<WeightDto> Weights,
    IReadOnlyList<AnimalDto> Offspring);

public sealed record GetAnimalQuery(Guid Id, string? Today) : IQuery<AnimalDetailDto>;

public sealed record SaveAnimalCommand(Guid? Id, string TagNumber, string? Name, string Type, string? Species,
    string? Breed, string Sex, string? BirthDate, Guid? UnitId, Guid? DamId, Guid? SireId, string Source,
    string? AcquiredOn, decimal PurchasePrice, string? Notes) : ICommand<AnimalDto>;

/// <summary>Marks an animal culled (or back to active). Sold and dead come from sales and mortality records.</summary>
public sealed record SetAnimalStatusCommand(Guid Id, string Status, string? Date, string? Reason) : ICommand<AnimalDto>;
public sealed record DeleteAnimalCommand(Guid Id) : ICommand;

// ── Batches (flocks, ponds, plantings, hives) ───────────────────────────────

public sealed record BatchDto(Guid Id, string Code, string Type, string? Species, string? Breed, Guid? UnitId,
    string? UnitName, string StartDate, int InitialCount, int Deaths, int Sold, int CurrentCount, decimal Area,
    decimal InitialCost, string? ExpectedEndDate, string Status, string? ClosedOn, string? Notes, int AgeDays,
    decimal MortalityPct, decimal FeedQty, decimal FeedCost, decimal ProductionQty, decimal? LatestWeightKg,
    decimal? Fcr, decimal SalesTotal);

public sealed record GetBatchesQuery(string? Type, string? Status, string? Today) : IQuery<IReadOnlyList<BatchDto>>;
public sealed record SaveBatchCommand(Guid? Id, string Code, string Type, string? Species, string? Breed, Guid? UnitId,
    string StartDate, int InitialCount, decimal Area, decimal InitialCost, string? ExpectedEndDate, string? Notes)
    : ICommand<BatchDto>;
public sealed record CloseBatchCommand(Guid Id, string? On, bool Reopen) : ICommand<BatchDto>;
public sealed record DeleteBatchCommand(Guid Id) : ICommand;

// ── Breeding and weights ────────────────────────────────────────────────────

public sealed record BreedingDto(Guid Id, Guid AnimalId, string? AnimalTag, string ServiceDate, string Method,
    Guid? SireId, string? SireTag, string? SireNote, string? ExpectedOn, string Outcome, string? OutcomeOn,
    int Offspring, string? Notes);
public sealed record GetBreedingQuery(Guid? AnimalId, bool PendingOnly) : IQuery<IReadOnlyList<BreedingDto>>;
public sealed record SaveBreedingCommand(Guid? Id, Guid AnimalId, string ServiceDate, string Method, Guid? SireId,
    string? SireNote, string? ExpectedOn, string? Notes) : ICommand<BreedingDto>;
public sealed record RecordBreedingOutcomeCommand(Guid Id, string Outcome, string? On, int Offspring) : ICommand<BreedingDto>;
public sealed record DeleteBreedingCommand(Guid Id) : ICommand;

public sealed record WeightDto(Guid Id, string Date, Guid? AnimalId, Guid? BatchId, decimal WeightKg, int SampleSize, string? Notes);
public sealed record GetWeightsQuery(Guid? AnimalId, Guid? BatchId) : IQuery<IReadOnlyList<WeightDto>>;
public sealed record AddWeightCommand(string Date, Guid? AnimalId, Guid? BatchId, decimal WeightKg, int SampleSize, string? Notes)
    : ICommand<WeightDto>;
public sealed record DeleteWeightCommand(Guid Id) : ICommand;

// ── Daily records ───────────────────────────────────────────────────────────

public sealed record ProductionDto(Guid Id, string Date, string Type, string Product, decimal Quantity, string Uom,
    string? Session, string? Grade, decimal Rejected, Guid? AnimalId, string? AnimalTag, Guid? BatchId, string? BatchCode,
    Guid? UnitId, string? UnitName, string? Notes, string? RecordedByName);
public sealed record GetProductionQuery(string? From, string? To, string? Type, string? Product, Guid? AnimalId, Guid? BatchId)
    : IQuery<IReadOnlyList<ProductionDto>>;
public sealed record SaveProductionCommand(Guid? Id, string Date, string Type, string Product, decimal Quantity, string Uom,
    string? Session, string? Grade, decimal Rejected, Guid? AnimalId, Guid? BatchId, Guid? UnitId, string? Notes)
    : ICommand<ProductionDto>;

/// <summary>One milking (or collection) for many animals at once — the daily dairy sheet.</summary>
public sealed record BulkProductionEntry(Guid AnimalId, decimal Quantity);
public sealed record BulkProductionCommand(string Date, string Product, string Uom, string? Session,
    IReadOnlyList<BulkProductionEntry> Entries) : ICommand<int>;
public sealed record DeleteProductionCommand(Guid Id) : ICommand;

public sealed record FeedDto(Guid Id, string Date, string FeedName, decimal Quantity, string Uom, decimal Cost,
    Guid? AnimalId, string? AnimalTag, Guid? BatchId, string? BatchCode, Guid? UnitId, string? UnitName, string? Notes);
public sealed record GetFeedQuery(string? From, string? To, Guid? BatchId, Guid? UnitId) : IQuery<IReadOnlyList<FeedDto>>;
public sealed record SaveFeedCommand(Guid? Id, string Date, string FeedName, decimal Quantity, string Uom, decimal Cost,
    Guid? AnimalId, Guid? BatchId, Guid? UnitId, string? Notes) : ICommand<FeedDto>;
public sealed record DeleteFeedCommand(Guid Id) : ICommand;

public sealed record HealthDto(Guid Id, string Date, string Kind, string Title, string? Medicine, string? Dose,
    string? VetName, decimal Cost, string? NextDueOn, int WithdrawalDays, string? WithdrawalUntil, Guid? AnimalId,
    string? AnimalTag, Guid? BatchId, string? BatchCode, string? Notes, bool Overdue);
public sealed record GetHealthQuery(string? From, string? To, string? Kind, Guid? AnimalId, Guid? BatchId, bool DueOnly,
    string? Today) : IQuery<IReadOnlyList<HealthDto>>;
public sealed record SaveHealthCommand(Guid? Id, string Date, string Kind, string Title, string? Medicine, string? Dose,
    string? VetName, decimal Cost, string? NextDueOn, int WithdrawalDays, Guid? AnimalId, Guid? BatchId, string? Notes)
    : ICommand<HealthDto>;
public sealed record ClearHealthDueCommand(Guid Id) : ICommand;
public sealed record DeleteHealthCommand(Guid Id) : ICommand;

public sealed record MortalityDto(Guid Id, string Date, Guid? AnimalId, string? AnimalTag, Guid? BatchId,
    string? BatchCode, int Count, string? Cause, string? Notes, string? RecordedByName);
public sealed record GetMortalityQuery(string? From, string? To, Guid? BatchId) : IQuery<IReadOnlyList<MortalityDto>>;
public sealed record AddMortalityCommand(string Date, Guid? AnimalId, Guid? BatchId, int Count, string? Cause, string? Notes)
    : ICommand<MortalityDto>;
public sealed record DeleteMortalityCommand(Guid Id) : ICommand;

public sealed record SaleDto(Guid Id, string Date, string Type, string Product, string? Buyer, string? BuyerPhone,
    decimal Quantity, string Uom, decimal UnitPrice, decimal Total, decimal AmountPaid, decimal Balance, Guid? AnimalId,
    string? AnimalTag, Guid? BatchId, string? BatchCode, int HeadCount, string? Notes);
public sealed record GetSalesQuery(string? From, string? To, string? Type, string? Product, bool UnpaidOnly)
    : IQuery<IReadOnlyList<SaleDto>>;
public sealed record SaveSaleCommand(Guid? Id, string Date, string Type, string Product, string? Buyer, string? BuyerPhone,
    decimal Quantity, string Uom, decimal UnitPrice, decimal AmountPaid, Guid? AnimalId, Guid? BatchId, int HeadCount,
    string? Notes) : ICommand<SaleDto>;
public sealed record DeleteSaleCommand(Guid Id) : ICommand;

public sealed record ExpenseDto(Guid Id, string Date, string Category, string Description, decimal Amount, string? Type,
    Guid? UnitId, string? UnitName, Guid? BatchId, string? BatchCode, string? PaidTo);
public sealed record GetExpensesQuery(string? From, string? To, string? Category) : IQuery<IReadOnlyList<ExpenseDto>>;
public sealed record SaveExpenseCommand(Guid? Id, string Date, string Category, string Description, decimal Amount,
    string? Type, Guid? UnitId, Guid? BatchId, string? PaidTo) : ICommand<ExpenseDto>;
public sealed record DeleteExpenseCommand(Guid Id) : ICommand;

// ── Dashboard ───────────────────────────────────────────────────────────────

public sealed record NameValue(string Name, decimal Value);
public sealed record ProductTotal(string Product, string Uom, decimal Today, decimal Last30Days);
public sealed record DailyPoint(string Date, decimal Value);
public sealed record FarmAlert(string Kind, string Text, string? Date, Guid? AnimalId, Guid? BatchId);

public sealed record FarmDashboardDto(
    IReadOnlyList<string> EnabledTypes,
    int ActiveAnimals, int ActiveBatches, int HeadInBatches,
    IReadOnlyList<NameValue> AnimalsByType, IReadOnlyList<NameValue> HeadByType,
    IReadOnlyList<ProductTotal> Production, IReadOnlyList<DailyPoint> MilkTrend, IReadOnlyList<DailyPoint> EggTrend,
    decimal Sales30d, decimal Unpaid, decimal FeedCost30d, decimal HealthCost30d, decimal OtherCost30d,
    decimal Profit30d, int Deaths30d, IReadOnlyList<FarmAlert> Alerts);

public sealed record GetFarmDashboardQuery(string? Today) : IQuery<FarmDashboardDto>;

// ── Reports hub ─────────────────────────────────────────────────────────────

/// <summary>Same shape as the other modules tabular reports, so the Reports hub can run them.</summary>
public sealed record FarmReportResult(IReadOnlyList<Dictionary<string, object?>> Rows, int TotalCount);

public sealed record RunFarmReportQuery(string ReportId, string? From, string? To, string? Today) : IQuery<FarmReportResult>;

// ── Validators ──────────────────────────────────────────────────────────────

public sealed class SaveFarmValidator : AbstractValidator<SaveFarmCommand>
{
    public SaveFarmValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Farm name is required.").MaximumLength(150);
        RuleFor(x => x.AreaAcres).GreaterThanOrEqualTo(0);
    }
}

public sealed class SaveUnitValidator : AbstractValidator<SaveUnitCommand>
{
    public SaveUnitValidator()
    {
        RuleFor(x => x.FarmId).NotEmpty().WithMessage("Choose the farm.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.").MaximumLength(120);
        RuleFor(x => x.Type).Must(FarmTypes.All.Contains).WithMessage("Unknown farm type.");
        RuleFor(x => x.Capacity).GreaterThanOrEqualTo(0);
    }
}

public sealed class SaveAnimalValidator : AbstractValidator<SaveAnimalCommand>
{
    public SaveAnimalValidator()
    {
        RuleFor(x => x.TagNumber).NotEmpty().WithMessage("Tag number is required.").MaximumLength(60);
        RuleFor(x => x.Type).Must(FarmTypes.All.Contains).WithMessage("Unknown farm type.");
        RuleFor(x => x.Sex).Must(s => s is "female" or "male").WithMessage("Sex must be female or male.");
        RuleFor(x => x.Source).Must(s => s is "born" or "purchased");
        RuleFor(x => x.BirthDate).Must(Dates.ValidOrEmpty).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.AcquiredOn).Must(Dates.ValidOrEmpty).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.PurchasePrice).GreaterThanOrEqualTo(0);
    }
}

public sealed class SaveBatchValidator : AbstractValidator<SaveBatchCommand>
{
    public SaveBatchValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage("Batch name or code is required.").MaximumLength(60);
        RuleFor(x => x.Type).Must(FarmTypes.All.Contains).WithMessage("Unknown farm type.");
        RuleFor(x => x.StartDate).Must(Dates.Valid).WithMessage("Start date: use yyyy-MM-dd.");
        RuleFor(x => x.ExpectedEndDate).Must(Dates.ValidOrEmpty).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.InitialCount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Area).GreaterThanOrEqualTo(0);
        RuleFor(x => x.InitialCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x).Must(x => x.InitialCount > 0 || x.Area > 0)
            .WithMessage("Enter how many it started with (or the planted area for a crop).");
    }
}

public sealed class SaveBreedingValidator : AbstractValidator<SaveBreedingCommand>
{
    public SaveBreedingValidator()
    {
        RuleFor(x => x.AnimalId).NotEmpty();
        RuleFor(x => x.ServiceDate).Must(Dates.Valid).WithMessage("Service date: use yyyy-MM-dd.");
        RuleFor(x => x.ExpectedOn).Must(Dates.ValidOrEmpty).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.Method).Must(m => m is "natural" or "ai");
    }
}

public sealed class BreedingOutcomeValidator : AbstractValidator<RecordBreedingOutcomeCommand>
{
    public BreedingOutcomeValidator()
    {
        RuleFor(x => x.Outcome).Must(o => o is "pending" or "born" or "failed");
        RuleFor(x => x.On).Must(Dates.ValidOrEmpty).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.Offspring).InclusiveBetween(0, 20);
    }
}

public sealed class AddWeightValidator : AbstractValidator<AddWeightCommand>
{
    public AddWeightValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.WeightKg).GreaterThan(0).WithMessage("Weight must be more than 0.");
        RuleFor(x => x).Must(x => (x.AnimalId is null) != (x.BatchId is null)).WithMessage("Weigh one animal or one batch.");
    }
}

public sealed class SaveProductionValidator : AbstractValidator<SaveProductionCommand>
{
    public SaveProductionValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.Type).Must(FarmTypes.All.Contains);
        RuleFor(x => x.Product).Must(FarmProducts.All.Contains).WithMessage("Unknown product.");
        RuleFor(x => x.Quantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Rejected).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Uom).NotEmpty().MaximumLength(20);
        RuleFor(x => x).Must(x => x.Quantity > 0 || x.Rejected > 0).WithMessage("Enter a quantity.");
    }
}

public sealed class BulkProductionValidator : AbstractValidator<BulkProductionCommand>
{
    public BulkProductionValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.Product).Must(FarmProducts.All.Contains);
        RuleFor(x => x.Uom).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Entries).NotEmpty().WithMessage("Enter at least one animal.").Must(e => e.Count <= 2000);
        RuleForEach(x => x.Entries).Must(e => e.Quantity >= 0);
    }
}

public sealed class SaveFeedValidator : AbstractValidator<SaveFeedCommand>
{
    public SaveFeedValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.FeedName).NotEmpty().WithMessage("Feed name is required.").MaximumLength(120);
        RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("Quantity must be more than 0.");
        RuleFor(x => x.Cost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Uom).NotEmpty().MaximumLength(20);
    }
}

public sealed class SaveHealthValidator : AbstractValidator<SaveHealthCommand>
{
    public SaveHealthValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.Kind).Must(k => k is "vaccination" or "treatment" or "deworming" or "checkup" or "other");
        RuleFor(x => x.Title).NotEmpty().WithMessage("Say what was given or done.").MaximumLength(200);
        RuleFor(x => x.NextDueOn).Must(Dates.ValidOrEmpty).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.Cost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.WithdrawalDays).InclusiveBetween(0, 365);
        RuleFor(x => x).Must(x => x.AnimalId is not null || x.BatchId is not null).WithMessage("Choose an animal or a batch.");
    }
}

public sealed class AddMortalityValidator : AbstractValidator<AddMortalityCommand>
{
    public AddMortalityValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x).Must(x => (x.AnimalId is null) != (x.BatchId is null)).WithMessage("Choose one animal or one batch.");
        RuleFor(x => x.Count).GreaterThan(0).WithMessage("Count must be at least 1.");
    }
}

public sealed class SaveSaleValidator : AbstractValidator<SaveSaleCommand>
{
    public SaveSaleValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.Type).Must(FarmTypes.All.Contains);
        RuleFor(x => x.Product).Must(FarmProducts.All.Contains).WithMessage("Unknown product.");
        RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("Quantity must be more than 0.");
        RuleFor(x => x.UnitPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.AmountPaid).GreaterThanOrEqualTo(0);
        RuleFor(x => x.HeadCount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Uom).NotEmpty().MaximumLength(20);
        RuleFor(x => x).Must(x => x.AmountPaid <= Math.Round(x.Quantity * x.UnitPrice, 2) + 0.01m)
            .WithMessage("Amount paid is more than the sale total.");
    }
}

public sealed class SaveExpenseValidator : AbstractValidator<SaveExpenseCommand>
{
    public SaveExpenseValidator()
    {
        RuleFor(x => x.Date).Must(Dates.Valid).WithMessage("Use yyyy-MM-dd.");
        RuleFor(x => x.Category).NotEmpty().MaximumLength(60);
        RuleFor(x => x.Description).NotEmpty().WithMessage("Description is required.").MaximumLength(300);
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be more than 0.");
    }
}
