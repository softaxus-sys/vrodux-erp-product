namespace Softaxis.Manufacturing.Domain.Entities;

/// <summary>
/// A machine, line or team that operations run on. Its two hourly rates are what turn the time an
/// operation takes into labour and overhead cost.
/// </summary>
public sealed class WorkCentre
{
    private WorkCentre() { }

    public WorkCentre(string name, string? code, decimal labourRatePerHour, decimal overheadRatePerHour,
        decimal capacityHoursPerDay = 8)
    {
        Id = Guid.NewGuid();
        Set(name, code, labourRatePerHour, overheadRatePerHour, capacityHoursPerDay);
    }

    public Guid      Id                  { get; private set; }
    public string    Name                { get; private set; } = null!;
    public string?   Code                { get; private set; }
    public decimal   LabourRatePerHour   { get; private set; }
    public decimal   OverheadRatePerHour { get; private set; }
    /// <summary>Productive hours this centre can give in a day. Drives the load view.</summary>
    public decimal   CapacityHoursPerDay { get; private set; } = 8;
    public bool      IsActive            { get; private set; } = true;
    public bool      IsDeleted           { get; private set; }
    public DateTime  CreatedAt           { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt           { get; private set; }

    public void Update(string name, string? code, decimal labourRatePerHour, decimal overheadRatePerHour,
        bool isActive, decimal capacityHoursPerDay = 8)
    {
        Set(name, code, labourRatePerHour, overheadRatePerHour, capacityHoursPerDay);
        IsActive  = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    private void Set(string name, string? code, decimal labourRatePerHour, decimal overheadRatePerHour,
        decimal capacityHoursPerDay)
    {
        CapacityHoursPerDay = capacityHoursPerDay > 0 ? capacityHoursPerDay : 8;
        Name                = name.Trim();
        Code                = string.IsNullOrWhiteSpace(code) ? null : code.Trim();
        LabourRatePerHour   = labourRatePerHour;
        OverheadRatePerHour = overheadRatePerHour;
    }
}

/// <summary>
/// One step of a BOM's routing. Time is split the usual way: <see cref="SetupMinutes"/> is spent
/// once per production order, <see cref="RunMinutesPerBatch"/> once per batch made. The rates are
/// copied from the work centre when the BOM is saved, like component costs.
/// </summary>
public sealed class BomOperation
{
    private BomOperation() { }

    public BomOperation(Guid bomId, int sequence, string name, Guid workCentreId, string workCentreName,
        decimal setupMinutes, decimal runMinutesPerBatch, decimal labourRate, decimal overheadRate)
    {
        Id                 = Guid.NewGuid();
        BomId              = bomId;
        Sequence           = sequence;
        Name               = name.Trim();
        WorkCentreId       = workCentreId;
        WorkCentreName     = workCentreName;
        SetupMinutes       = setupMinutes;
        RunMinutesPerBatch = runMinutesPerBatch;
        LabourRate         = labourRate;
        OverheadRate       = overheadRate;
    }

    public Guid    Id                 { get; private set; }
    public Guid    BomId              { get; private set; }
    public int     Sequence           { get; private set; }
    public string  Name               { get; private set; } = null!;
    public Guid    WorkCentreId       { get; private set; }
    public string  WorkCentreName     { get; private set; } = null!;
    public decimal SetupMinutes       { get; private set; }
    public decimal RunMinutesPerBatch { get; private set; }
    public decimal LabourRate         { get; private set; }   // per hour
    public decimal OverheadRate       { get; private set; }   // per hour

    /// <summary>Labour + overhead for one batch, setup included.</summary>
    public decimal BatchCost =>
        Math.Round((SetupMinutes + RunMinutesPerBatch) / 60m * (LabourRate + OverheadRate), 4);
}

/// <summary>
/// A routing step on a production order, copied from the BOM and scaled to the order's quantity.
/// Cost is taken from the time actually recorded, not the plan.
/// </summary>
public sealed class ProductionOrderOperation
{
    private ProductionOrderOperation() { }

    public ProductionOrderOperation(Guid productionOrderId, int sequence, string name, Guid workCentreId,
        string workCentreName, decimal plannedMinutes, decimal labourRate, decimal overheadRate)
    {
        Id                = Guid.NewGuid();
        ProductionOrderId = productionOrderId;
        Sequence          = sequence;
        Name              = name;
        WorkCentreId      = workCentreId;
        WorkCentreName    = workCentreName;
        PlannedMinutes    = plannedMinutes;
        LabourRate        = labourRate;
        OverheadRate      = overheadRate;
    }

    public Guid      Id                { get; private set; }
    public Guid      ProductionOrderId { get; private set; }
    public int       Sequence          { get; private set; }
    public string    Name              { get; private set; } = null!;
    public Guid      WorkCentreId      { get; private set; }
    public string    WorkCentreName    { get; private set; } = null!;
    public decimal   PlannedMinutes    { get; private set; }
    public decimal   ActualMinutes     { get; private set; }
    public decimal   LabourRate        { get; private set; }
    public decimal   OverheadRate      { get; private set; }
    public bool      IsDone            { get; private set; }
    public DateTime? DoneAt            { get; private set; }

    public decimal LabourCost   => Math.Round(ActualMinutes / 60m * LabourRate, 4);
    public decimal OverheadCost => Math.Round(ActualMinutes / 60m * OverheadRate, 4);

    internal void Record(decimal actualMinutes)
    {
        ActualMinutes = actualMinutes;
        IsDone        = true;
        DoneAt        = DateTime.UtcNow;
    }
}
