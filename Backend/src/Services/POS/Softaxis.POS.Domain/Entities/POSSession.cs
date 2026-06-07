using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Domain.Exceptions;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Events;

namespace Softaxis.POS.Domain.Entities;

public sealed class POSSession : AuditableEntity<Guid>
{
    public Guid          CashierId      { get; private set; }
    public string        RegisterId     { get; private set; } = default!;
    public SessionStatus Status         { get; private set; }
    public DateTime      OpenedAt       { get; private set; }
    public DateTime?     ClosedAt       { get; private set; }
    public decimal       OpeningCash    { get; private set; }
    public decimal       ClosingCash    { get; private set; }
    public decimal       ExpectedCash   { get; private set; }
    public decimal       CashVariance   { get; private set; }
    public string?       Notes          { get; private set; }

    // Summary totals (computed at close)
    public int     TotalTransactions { get; private set; }
    public decimal TotalSales        { get; private set; }
    public decimal TotalRefunds      { get; private set; }
    public decimal NetSales          => TotalSales - TotalRefunds;

    // Navigation
    public ICollection<POSTransaction>   Transactions    { get; private set; } = [];
    public ICollection<HeldTransaction>  HeldTransactions { get; private set; } = [];

    private POSSession() { }

    public static Result<POSSession> Open(Guid cashierId, string registerId, decimal openingCash)
    {
        if (string.IsNullOrWhiteSpace(registerId))
            return Result.Failure<POSSession>(Error.Custom("Session.RegisterRequired", "Register ID is required."));

        if (openingCash < 0)
            return Result.Failure<POSSession>(Error.Custom("Session.InvalidOpeningCash", "Opening cash cannot be negative."));

        var session = new POSSession
        {
            Id           = Guid.NewGuid(),
            CashierId    = cashierId,
            RegisterId   = registerId.Trim(),
            Status       = SessionStatus.Open,
            OpenedAt     = DateTime.UtcNow,
            OpeningCash  = openingCash,
            ExpectedCash = openingCash
        };

        session.RaiseDomainEvent(new SessionOpenedEvent(session.Id, cashierId, registerId));

        return Result.Success(session);
    }

    public Result Suspend(string? notes = null)
    {
        if (Status != SessionStatus.Open)
            return Result.Failure(Error.Custom("Session.NotOpen", "Only open sessions can be suspended."));

        Status = SessionStatus.Suspended;
        Notes  = notes?.Trim();

        return Result.Success();
    }

    public Result Resume()
    {
        if (Status != SessionStatus.Suspended)
            return Result.Failure(Error.Custom("Session.NotSuspended", "Only suspended sessions can be resumed."));

        Status = SessionStatus.Open;

        return Result.Success();
    }

    public Result Close(decimal closingCash, string? notes = null)
    {
        if (Status == SessionStatus.Closed)
            return Result.Failure(Error.Custom("Session.AlreadyClosed", "Session is already closed."));

        if (closingCash < 0)
            return Result.Failure(Error.Custom("Session.InvalidClosingCash", "Closing cash cannot be negative."));

        Status       = SessionStatus.Closed;
        ClosedAt     = DateTime.UtcNow;
        ClosingCash  = closingCash;
        CashVariance = closingCash - ExpectedCash;
        Notes        = notes?.Trim();

        RaiseDomainEvent(new SessionClosedEvent(Id, CashierId, TotalSales, TotalRefunds, CashVariance));

        return Result.Success();
    }

    public void RecordTransaction(decimal amount, bool isRefund)
    {
        TotalTransactions++;
        if (isRefund)
            TotalRefunds += amount;
        else
        {
            TotalSales   += amount;
            ExpectedCash += amount; // Cash sales increase expected cash
        }
    }

    /// <summary>Adjust expected cash for a manual pay-in (adds) or pay-out (removes).</summary>
    public Result RecordCashMovement(decimal amount, bool isPayIn)
    {
        if (Status != SessionStatus.Open)
            return Result.Failure(Error.Custom("Session.NotOpen",
                "Cash movements can only be recorded in an open session."));
        if (amount <= 0)
            return Result.Failure(Error.Custom("CashMovement.InvalidAmount", "Amount must be greater than zero."));

        ExpectedCash += isPayIn ? amount : -amount;
        return Result.Success();
    }
}
