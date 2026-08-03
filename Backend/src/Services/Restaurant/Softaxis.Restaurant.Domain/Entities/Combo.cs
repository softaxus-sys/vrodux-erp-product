namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>A fixed-price meal deal bundling several menu items (e.g. "Burger Combo" = burger + fries +
/// drink at one price). Ordering a combo fans out into one OrderItem per component (see
/// AddComboToOrderHandler), each proportionally re-priced so their sum equals Price, and tagged with a
/// shared ComboOrderItemId so KDS/receipts can group them as one logical line.</summary>
public sealed class Combo
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; } = null!;
    public decimal Price { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;
    public List<ComboItem> Items { get; private set; } = [];

    public Combo(string name, decimal price)
    {
        Name = name; Price = price;
    }

    public void Update(string name, decimal price, bool isActive)
    {
        Name = name; Price = price; IsActive = isActive; UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>One component slot in a combo — either a fixed MenuItem, or a "choose one" slot scoped to a
/// CategoryId (exactly one of the two is set; enforced by the command validator, not a DB constraint,
/// same convention as this codebase's other scalar-FK "either/or" references).</summary>
public sealed class ComboItem
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ComboId { get; private set; }
    public Guid? MenuItemId { get; private set; }
    public Guid? CategoryId { get; private set; }
    public int Quantity { get; private set; }
    public int SortOrder { get; private set; }

    public ComboItem(Guid comboId, Guid? menuItemId, Guid? categoryId, int quantity, int sortOrder)
    {
        ComboId = comboId; MenuItemId = menuItemId; CategoryId = categoryId; Quantity = quantity; SortOrder = sortOrder;
    }

    public bool IsChoice => CategoryId.HasValue;
}

/// <summary>Time-boxed automatic discount (e.g. "Happy Hour 5-7pm: 20% off drinks"), applied as a
/// computed OrderDiscount at order-creation time — not a permanent price change, and reversible if the
/// order is edited after the window closes (the discount simply won't be re-applied on save).</summary>
public sealed class HappyHourRule
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid? BranchId { get; private set; }
    public string Name { get; private set; } = null!;
    /// <summary>Bitmask over <see cref="DayOfWeek"/> values — bit (1 &lt;&lt; (int)DayOfWeek) set = active that day.</summary>
    public int DaysOfWeekMask { get; private set; }
    public string StartTime { get; private set; } = null!; // HH:mm
    public string EndTime { get; private set; } = null!;   // HH:mm
    public string DiscountType { get; private set; } = "percentage"; // percentage/flat
    public decimal DiscountValue { get; private set; }
    /// <summary>Scopes the discount to one menu category's items only; null = the whole order subtotal.</summary>
    public Guid? CategoryId { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public HappyHourRule(string name, int daysOfWeekMask, string startTime, string endTime,
        string discountType, decimal discountValue, Guid? categoryId, Guid? branchId = null)
    {
        Name = name; DaysOfWeekMask = daysOfWeekMask; StartTime = startTime; EndTime = endTime;
        DiscountType = discountType; DiscountValue = discountValue; CategoryId = categoryId; BranchId = branchId;
    }

    public void Update(string name, int daysOfWeekMask, string startTime, string endTime,
        string discountType, decimal discountValue, Guid? categoryId, bool isActive)
    {
        Name = name; DaysOfWeekMask = daysOfWeekMask; StartTime = startTime; EndTime = endTime;
        DiscountType = discountType; DiscountValue = discountValue; CategoryId = categoryId; IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Whether this rule is in effect right now for the given branch (same-day windows only —
    /// an EndTime earlier than StartTime is treated as never matching, a documented v1 simplification).</summary>
    public bool Matches(DateTime now, Guid? branchId)
    {
        if (!IsActive) return false;
        if (BranchId.HasValue && BranchId != branchId) return false;
        if ((DaysOfWeekMask & (1 << (int)now.DayOfWeek)) == 0) return false;
        if (!TimeSpan.TryParse(StartTime, out var start) || !TimeSpan.TryParse(EndTime, out var end)) return false;
        if (end <= start) return false;
        var t = now.TimeOfDay;
        return t >= start && t <= end;
    }
}
