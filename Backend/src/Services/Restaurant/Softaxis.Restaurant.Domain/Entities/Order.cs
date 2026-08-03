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
    /// <summary>How the order was placed — "pos" (staff-entered, the default), "qr_table" (guest scanned
    /// a table QR code), or "kiosk" (self-ordering kiosk). Purely informational/reporting; doesn't
    /// affect order processing.</summary>
    public string OrderChannel { get; private set; } = "pos";
    public decimal SubTotal { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal Total { get; private set; }
    public decimal AmountPaid { get; private set; }
    /// <summary>Captured at payment time, separate from Total (SubTotal+Tax-Discount) — the amount
    /// actually due is Total + TipAmount (see Outstanding). Not included in Recalculate() since it
    /// isn't derived from items/discounts.</summary>
    public decimal TipAmount { get; private set; }
    public string? PaymentMethod { get; private set; }
    public string? Notes { get; private set; }
    /// <summary>Scalar reference to Identity's Branch (cross-service, no FK constraint — same
    /// convention as every other cross-service reference in this codebase). Null = tenant has a
    /// single unbranched location.</summary>
    public Guid? BranchId { get; private set; }
    /// <summary>Scalar reference to the POS session (shift) this order's sales are recorded against
    /// (cross-schema — pos.pos_sessions). Null = not opened under a tracked shift (legacy order, or a
    /// register not using shift tracking) — payments on such orders never touch a cash drawer total.</summary>
    public Guid? SessionId { get; private set; }
    /// <summary>The user who rang up this order — resolved server-side from the JWT, never client-supplied.</summary>
    public Guid? CashierId { get; private set; }
    /// <summary>Scalar reference to POS's Customer (cross-service, no FK constraint) — set when the
    /// guest is a known customer (loyalty/wallet/house-account). Null = walk-in/unattributed.</summary>
    public Guid? CustomerId { get; private set; }
    /// <summary>Set when this order is a split-bill child — points at the original order that was
    /// split. The parent's own items were moved onto its children (see CreateSplit); the parent's
    /// Status becomes "split" and it's never directly payable again — only its children are.</summary>
    public Guid? ParentOrderId { get; private set; }
    /// <summary>Which course is currently being fired to the kitchen (1-based). Items with a
    /// CourseNumber greater than this are held back until FireNextCourse() releases them.</summary>
    public int CurrentCourse { get; private set; } = 1;
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;
    /// <summary>EF Core concurrency token — detects two concurrent edits to the same order
    /// (e.g. two waiters adding items) instead of silently letting the later write clobber the earlier one.</summary>
    public byte[] RowVersion { get; private set; } = [];
    public List<OrderItem> Items { get; private set; } = [];
    public List<OrderPayment> Payments { get; private set; } = [];
    public List<OrderDiscount> Discounts { get; private set; } = [];
    public List<OrderVoidLog> VoidLogs { get; private set; } = [];
    public List<OrderRefund> Refunds { get; private set; } = [];

    public Order(Guid tableId, string tableNumber, string waiter, int covers, string orderType, string? notes,
        Guid? branchId = null, Guid? sessionId = null, Guid? cashierId = null, string orderChannel = "pos",
        Guid? customerId = null)
    {
        OrderNumber = $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        TableId = tableId; TableNumber = tableNumber; Waiter = waiter;
        Covers = covers; OrderType = orderType; Notes = notes;
        BranchId = branchId; SessionId = sessionId; CashierId = cashierId; OrderChannel = orderChannel;
        CustomerId = customerId;
    }

    /// <summary>Links (or unlinks) this order to a POS customer — e.g. picked mid-order at the pay
    /// dialog, not necessarily known at creation time.</summary>
    public void SetCustomer(Guid? customerId) { CustomerId = customerId; UpdatedAt = DateTime.UtcNow; }

    public void Recalculate()
    {
        // Excludes voided items — previously this summed ALL items including soft-deleted ones,
        // so voiding/removing an item never actually reduced the total.
        SubTotal = Items.Where(i => !i.IsDeleted).Sum(i => i.LineTotal);
        TaxAmount = Math.Round(SubTotal * 0.05m, 2); // 5% VAT
        DiscountAmount = Discounts.Where(d => !d.IsVoided).Sum(d => d.Amount);
        Total = SubTotal + TaxAmount - DiscountAmount;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Applies a discount, audited (type/amount/reason/who). Any previously-active discount is
    /// superseded (voided with a system reason) — matches the existing "one active discount at a
    /// time" UX; the underlying table still supports multiple simultaneous discounts if a future UI
    /// needs it. <paramref name="approvedByUserId"/> is set when the applying user needed a
    /// manager's approval to exceed their own discount authority (not yet enforced — PIN-approval is
    /// a separate follow-up).
    /// </summary>
    public void ApplyDiscount(string type, decimal amount, string reason, Guid appliedByUserId, Guid? approvedByUserId = null)
    {
        foreach (var d in Discounts.Where(d => !d.IsVoided))
            d.Void(appliedByUserId, "Superseded by a new discount.");

        Discounts.Add(new OrderDiscount(Id, type, Math.Max(0, amount), reason, appliedByUserId, approvedByUserId));
        Recalculate();
    }

    /// <summary>Removes whatever discount is currently active, audited (who/why/when).</summary>
    public void RemoveDiscount(string reason, Guid voidedByUserId)
    {
        foreach (var d in Discounts.Where(d => !d.IsVoided))
            d.Void(voidedByUserId, reason);
        Recalculate();
    }

    /// <summary>Moves this order to a different table (e.g. a guest asks to switch seats mid-meal) —
    /// distinct from a table merge. Caller (TransferOrderTableHandler) is responsible for freeing the
    /// old table / occupying the new one and writing the TableTransferLog audit row.</summary>
    public void TransferTable(Guid newTableId, string newTableNumber)
    {
        TableId = newTableId; TableNumber = newTableNumber; UpdatedAt = DateTime.UtcNow;
    }

    public void SendToKitchen() { Status = "sent"; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Marks the whole order ready and cascades to every item not already further along —
    /// the quick "Mark Ready" action (as opposed to the KDS per-item flow) previously left every
    /// OrderItem.Status stuck at "pending", which both under-reported kitchen prep times and never
    /// visually updated the KDS for orders handled this way.</summary>
    public void MarkReady()
    {
        Status = "ready"; UpdatedAt = DateTime.UtcNow;
        foreach (var item in Items.Where(i => !i.IsDeleted && (i.Status == "pending" || i.Status == "preparing")))
            item.UpdateStatus("ready");
    }

    /// <summary>Marks the whole order served and cascades to every non-voided item — same rationale
    /// as MarkReady (the quick "Serve" action bypasses the KDS per-item flow entirely).</summary>
    public void Serve()
    {
        Status = "served"; UpdatedAt = DateTime.UtcNow;
        foreach (var item in Items.Where(i => !i.IsDeleted && i.Status != "served"))
            item.UpdateStatus("served");
    }
    private void Cancel() { Status = "cancelled"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Sets (or replaces) the tip amount — typically captured just before payment.
    /// Clamped to zero as a defensive backstop; the handler blocks this on a closed order.</summary>
    public void SetTip(decimal amount) { TipAmount = Math.Max(0, amount); UpdatedAt = DateTime.UtcNow; }

    /// <summary>Parks an order aside (e.g. the terminal is needed for something else before this
    /// tab/ticket is ready to send) without losing its items. Only from "open" — an order already
    /// sent to the kitchen or further along isn't "held" in this sense, it's just in progress.</summary>
    public void Hold() { Status = "held"; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Resumes a held order — back to normal editing.</summary>
    public void Recall() { Status = "open"; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Releases the next course to the kitchen — items tagged with CourseNumber ==
    /// CurrentCourse+1 become fireable. Purely a counter; the kitchen-ticket query filters on it.</summary>
    public void FireNextCourse() { CurrentCourse++; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Voids a single item off the order — audited (reason required, who voided it) instead
    /// of a silent delete. Returns false if the item doesn't exist or is already voided.</summary>
    public bool VoidItem(Guid itemId, string reason, Guid voidedByUserId)
    {
        var item = Items.FirstOrDefault(i => i.Id == itemId && !i.IsDeleted);
        if (item is null) return false;

        item.Delete();
        VoidLogs.Add(new OrderVoidLog(Id, itemId, reason, voidedByUserId));
        Recalculate();
        return true;
    }

    /// <summary>Voids the whole order — audited replacement for a bare status flip to "cancelled".</summary>
    public void VoidWholeOrder(string reason, Guid voidedByUserId)
    {
        Cancel();
        VoidLogs.Add(new OrderVoidLog(Id, null, reason, voidedByUserId));
    }

    /// <summary>
    /// Creates one split-bill child, copying this order's table/waiter/session context, and moves
    /// the given items onto it (removed from this order's Items, reassigned to the child). Call once
    /// per split group, then MarkSplit() on this (the parent) once every item has been distributed —
    /// the caller (SplitOrderHandler) is responsible for validating up front that every item ends up
    /// in exactly one group.
    /// </summary>
    public Order CreateSplit(IEnumerable<OrderItem> itemsToMove)
    {
        var child = new Order(TableId, TableNumber, Waiter, Covers, OrderType, Notes, BranchId, SessionId, CashierId,
            customerId: CustomerId);
        child.SetParent(Id);

        foreach (var item in itemsToMove.ToList())
        {
            Items.Remove(item);
            item.ReassignToOrder(child.Id);
            child.Items.Add(item);
        }
        child.Recalculate();
        return child;
    }

    private void SetParent(Guid parentOrderId) { ParentOrderId = parentOrderId; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Marks this order as split — it no longer holds any items directly and is never
    /// directly payable again; only its children (created via CreateSplit) can be paid.</summary>
    public void MarkSplit() { Status = "split"; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Called once every split child has been fully paid — settles the parent (so it drops
    /// out of "active order" views the same way a normal paid order would) and lets the caller free
    /// the table. The parent's own monetary fields are all zero by this point (its items/payments
    /// live on the children), so marking it "paid" never double-counts revenue in reports.</summary>
    public void MarkSplitSettled() { Status = "paid"; UpdatedAt = DateTime.UtcNow; }

    /// <summary>What's still owed — Total (SubTotal+Tax-Discount) plus any tip, minus what's been paid.</summary>
    public decimal Outstanding => Math.Max(0, Total + TipAmount - AmountPaid);

    /// <summary>Record a (possibly partial) payment. Marks the order paid once Total+TipAmount is fully covered.</summary>
    public bool AddPayment(string method, decimal amount, string? reference = null)
    {
        if (amount <= 0) return false;
        Payments.Add(new OrderPayment(Id, method, amount, reference));
        AmountPaid += amount;
        PaymentMethod = Payments.Select(p => p.Method).Distinct().Count() > 1 ? "Split" : method;
        UpdatedAt = DateTime.UtcNow;
        if (AmountPaid >= Total + TipAmount - 0.01m) { Status = "paid"; return true; }
        return false;
    }

    /// <summary>Pay the full outstanding balance (Total+Tip) in one go (single method).</summary>
    public void Pay(string method) => AddPayment(method, Outstanding > 0 ? Outstanding : Total + TipAmount, null);

    /// <summary>
    /// Refunds part or all of what's been paid so far, audited. Doesn't reverse Status away from
    /// "paid" — mirrors how POSTransaction refunds work (the sale stays "completed"; the refund is a
    /// separate tracked cash-flow event). Clamped to [0, AmountPaid] as a defensive backstop; the
    /// handler validates the request amount up front for a friendlier error message.
    /// </summary>
    public void Refund(decimal amount, string reason, string method, Guid refundedByUserId)
    {
        var clamped = Math.Min(Math.Max(0, amount), AmountPaid);
        AmountPaid -= clamped;
        Refunds.Add(new OrderRefund(Id, clamped, reason, method, refundedByUserId));
        UpdatedAt = DateTime.UtcNow;
    }
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
    /// <summary>Free-text special instructions (e.g. "no onions") — kept separate from the
    /// structured, priced SelectedModifiers below.</summary>
    public string? Modifiers { get; private set; }
    public string Status { get; private set; } = "pending"; // pending/preparing/ready/served
    /// <summary>When this item first entered "ready" — set once, never overwritten by a later
    /// re-save. Powers the kitchen prep-time report (fired→ready is the actual kitchen-facing metric).</summary>
    public DateTime? ReadyAt { get; private set; }
    /// <summary>When this item first entered "served" — set once, never overwritten.</summary>
    public DateTime? ServedAt { get; private set; }
    /// <summary>Which course this item belongs to (1-based) — held back from the kitchen until
    /// Order.CurrentCourse reaches this number. Default 1 = fires immediately, same as before courses existed.</summary>
    public int CourseNumber { get; private set; } = 1;
    /// <summary>Set when this item is one component of a combo — shares one Guid across every
    /// component of the same combo instance so KDS/receipts can group them as one logical line.</summary>
    public Guid? ComboOrderItemId { get; private set; }
    /// <summary>Set once recipe-linked ingredient stock has been deducted for this line (on first
    /// serve) — guards against deducting twice, since a serve can be triggered either per-item
    /// (kitchen status endpoint) or via the whole-order serve action, and neither path otherwise
    /// knows whether the other already ran for this specific item.</summary>
    public bool StockDeducted { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public List<OrderItemModifier> SelectedModifiers { get; private set; } = [];

    // computed — not mapped. Modifier price deltas apply per unit, matching standard POS behaviour
    // (3x "Large Pizza" costs 3 * (base + modifier deltas), not base*3 + deltas once).
    public decimal LineTotal => Quantity * (UnitPrice + SelectedModifiers.Sum(m => m.PriceDelta));

    public OrderItem(Guid orderId, Guid menuItemId, string itemName, int quantity, decimal unitPrice, string? modifiers,
        int courseNumber = 1, Guid? comboOrderItemId = null)
    {
        OrderId = orderId; MenuItemId = menuItemId; ItemName = itemName;
        Quantity = quantity; UnitPrice = unitPrice; Modifiers = modifiers;
        CourseNumber = courseNumber; ComboOrderItemId = comboOrderItemId;
    }

    public void UpdateStatus(string status)
    {
        Status = status;
        if (status == "ready" && ReadyAt is null) ReadyAt = DateTime.UtcNow;
        if (status == "served" && ServedAt is null) ServedAt = DateTime.UtcNow;
    }
    public void Delete() { IsDeleted = true; }

    /// <summary>Marks that recipe stock has been deducted for this line — call exactly once, right
    /// after a successful deduction. Returns false if it was already marked (caller should then
    /// skip deducting again).</summary>
    public bool MarkStockDeducted()
    {
        if (StockDeducted) return false;
        StockDeducted = true;
        return true;
    }

    /// <summary>Moves this item onto a different order — used when splitting a bill (see
    /// Order.CreateSplit). The item's identity, prep status, and modifiers all carry over unchanged.</summary>
    internal void ReassignToOrder(Guid newOrderId) { OrderId = newOrderId; }

    /// <summary>Attaches the caller-validated, priced modifier selections for this line — snapshots
    /// Name/PriceDelta at order time so a later price/name change to the Modifier itself never
    /// alters a historical order.</summary>
    public void SetSelectedModifiers(IEnumerable<(Guid? ModifierId, string Name, decimal PriceDelta)> selections)
    {
        foreach (var s in selections)
            SelectedModifiers.Add(new OrderItemModifier(Id, s.ModifierId, s.Name, s.PriceDelta));
    }
}

/// <summary>A priced modifier selection on an order item — snapshot of the Modifier's Name/PriceDelta
/// at the time it was chosen (ModifierId kept for traceability only; it may later be deleted).</summary>
public sealed class OrderItemModifier
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderItemId { get; private set; }
    public Guid? ModifierId { get; private set; }
    public string Name { get; private set; } = null!;
    public decimal PriceDelta { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public OrderItemModifier(Guid orderItemId, Guid? modifierId, string name, decimal priceDelta)
    {
        OrderItemId = orderItemId; ModifierId = modifierId; Name = name; PriceDelta = priceDelta;
    }
}

/// <summary>Audit trail row for a discount applied to an order — replaces the old flat,
/// unaudited Order.DiscountAmount field. Order.DiscountAmount is now the computed sum of
/// non-voided rows (see Order.Recalculate).</summary>
public sealed class OrderDiscount
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public string Type { get; private set; } = null!; // flat/percentage/voucher
    public decimal Amount { get; private set; }        // the computed discount amount, not a raw percentage
    public string Reason { get; private set; } = null!;
    public Guid AppliedByUserId { get; private set; }
    public Guid? ApprovedByUserId { get; private set; }
    public bool IsVoided { get; private set; }
    public Guid? VoidedByUserId { get; private set; }
    public string? VoidReason { get; private set; }
    public DateTime? VoidedAt { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public OrderDiscount(Guid orderId, string type, decimal amount, string reason,
        Guid appliedByUserId, Guid? approvedByUserId)
    {
        OrderId = orderId; Type = type; Amount = amount; Reason = reason;
        AppliedByUserId = appliedByUserId; ApprovedByUserId = approvedByUserId;
    }

    public void Void(Guid voidedByUserId, string voidReason)
    {
        IsVoided = true; VoidedByUserId = voidedByUserId; VoidReason = voidReason; VoidedAt = DateTime.UtcNow;
    }
}

/// <summary>Audit trail row for voiding a single item (OrderItemId set) or the whole order
/// (OrderItemId null) — replaces the old silent soft-delete / bare status flip.</summary>
public sealed class OrderVoidLog
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public Guid? OrderItemId { get; private set; }
    public string Reason { get; private set; } = null!;
    public Guid VoidedByUserId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public OrderVoidLog(Guid orderId, Guid? orderItemId, string reason, Guid voidedByUserId)
    {
        OrderId = orderId; OrderItemId = orderItemId; Reason = reason; VoidedByUserId = voidedByUserId;
    }
}

/// <summary>A (possibly partial) refund against an already-paid order. Doesn't reverse
/// Order.Status — see Order.Refund.</summary>
public sealed class OrderRefund
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public decimal Amount { get; private set; }
    public string Reason { get; private set; } = null!;
    public string Method { get; private set; } = null!;
    public Guid RefundedByUserId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public OrderRefund(Guid orderId, decimal amount, string reason, string method, Guid refundedByUserId)
    {
        OrderId = orderId; Amount = amount; Reason = reason; Method = method; RefundedByUserId = refundedByUserId;
    }
}
