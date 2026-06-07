namespace Softaxis.Restaurant.Domain.Entities;

public sealed class Order
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string OrderNumber { get; private set; } = null!;
    public Guid TableId { get; private set; }
    public string TableNumber { get; private set; } = null!;
    public string Waiter { get; private set; } = null!;
    public int Covers { get; private set; } // number of guests
    public string Status { get; private set; } = "open"; // open/sent/ready/served/paid/cancelled
    public string OrderType { get; private set; } = "dine_in"; // dine_in/takeaway/delivery
    public decimal SubTotal { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal Total { get; private set; }
    public decimal AmountPaid { get; private set; }
    public string? PaymentMethod { get; private set; }
    public string? Notes { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;
    public List<OrderItem> Items { get; private set; } = [];
    public List<OrderPayment> Payments { get; private set; } = [];

    public Order(Guid tableId, string tableNumber, string waiter, int covers, string orderType, string? notes)
    {
        OrderNumber = $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        TableId = tableId; TableNumber = tableNumber; Waiter = waiter;
        Covers = covers; OrderType = orderType; Notes = notes;
    }

    public void Recalculate()
    {
        SubTotal = Items.Sum(i => i.LineTotal);
        TaxAmount = Math.Round(SubTotal * 0.05m, 2); // 5% VAT
        Total = SubTotal + TaxAmount - DiscountAmount;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ApplyDiscount(decimal amount) { DiscountAmount = Math.Max(0, amount); Recalculate(); }
    public void SendToKitchen() { Status = "sent"; UpdatedAt = DateTime.UtcNow; }
    public void MarkReady() { Status = "ready"; UpdatedAt = DateTime.UtcNow; }
    public void Serve() { Status = "served"; UpdatedAt = DateTime.UtcNow; }
    public void Cancel() { Status = "cancelled"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public decimal Outstanding => Math.Max(0, Total - AmountPaid);

    /// <summary>Record a (possibly partial) payment. Marks the order paid once fully covered.</summary>
    public bool AddPayment(string method, decimal amount, string? reference = null)
    {
        if (amount <= 0) return false;
        Payments.Add(new OrderPayment(Id, method, amount, reference));
        AmountPaid += amount;
        PaymentMethod = Payments.Select(p => p.Method).Distinct().Count() > 1 ? "Split" : method;
        UpdatedAt = DateTime.UtcNow;
        if (AmountPaid >= Total - 0.01m) { Status = "paid"; return true; }
        return false;
    }

    /// <summary>Pay the full outstanding balance in one go (single method).</summary>
    public void Pay(string method) => AddPayment(method, Outstanding > 0 ? Outstanding : Total, null);
}

public sealed class OrderPayment
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public string Method { get; private set; } = null!;   // Cash/Card/Voucher/...
    public decimal Amount { get; private set; }
    public string? Reference { get; private set; }        // member/guest label or txn ref
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public OrderPayment(Guid orderId, string method, decimal amount, string? reference)
    {
        OrderId = orderId; Method = method; Amount = amount; Reference = reference;
    }
}

public sealed class OrderItem
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public Guid MenuItemId { get; private set; }
    public string ItemName { get; private set; } = null!;
    public int Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public string? Modifiers { get; private set; } // e.g. "no onions, extra cheese"
    public string Status { get; private set; } = "pending"; // pending/preparing/ready/served
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    // computed — not mapped
    public decimal LineTotal => Quantity * UnitPrice;

    public OrderItem(Guid orderId, Guid menuItemId, string itemName, int quantity, decimal unitPrice, string? modifiers)
    {
        OrderId = orderId; MenuItemId = menuItemId; ItemName = itemName;
        Quantity = quantity; UnitPrice = unitPrice; Modifiers = modifiers;
    }

    public void UpdateStatus(string status) { Status = status; }
    public void Delete() { IsDeleted = true; }
}
