using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Charges an order payment against a POS customer's wallet (store credit) or house account (credit
/// limit) — reuses Customer's own domain methods (RedeemWallet/ChargeHouseAccount) via a direct
/// POSDbContext reference (same pattern as Recipe/Inventory in Epic 7), rather than duplicating the
/// balance/limit rules in Restaurant.
///
/// Must be called exactly ONCE, before the Order's own concurrency-retried save (see
/// PayOrderHandler/AddOrderPaymentHandler) — ConcurrencyRetry re-runs its whole delegate on a
/// DbUpdateConcurrencyException, and this charge is a real mutation (not idempotent), so it can never
/// live inside that retried block or a retry would double-charge the customer. This does leave a
/// narrow edge case where the wallet is charged but the Order's own save subsequently fails after all
/// retry attempts (order concurrency conflicts are rare) — an accepted small consistency gap, same
/// class as the ones already documented elsewhere in this codebase (e.g. PosSessionLedger's no-op on
/// a closed session), not solved with a distributed transaction across two DbContexts/services.
/// </summary>
internal static class CustomerPaymentSupport
{
    public const string WalletMethod = "Wallet";
    public const string HouseAccountMethod = "House Account";

    public static bool IsCustomerFundedMethod(string method) =>
        string.Equals(method, WalletMethod, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(method, HouseAccountMethod, StringComparison.OrdinalIgnoreCase);

    public static async Task<Result> ChargeAsync(
        POSDbContext posDb, Guid? customerId, string method, decimal amount, Guid orderId, CancellationToken ct)
    {
        if (customerId is null)
            return Result.Failure(Error.Custom("Order.Conflict", $"Link a customer to this order before paying by {method}."));

        var customer = await posDb.Customers.FirstOrDefaultAsync(c => c.Id == customerId.Value, ct);
        if (customer is null)
            return Result.Failure(Error.NotFoundById("Customer", customerId.Value));

        var isWallet = string.Equals(method, WalletMethod, StringComparison.OrdinalIgnoreCase);
        var chargeResult = isWallet ? customer.RedeemWallet(amount) : customer.ChargeHouseAccount(amount);
        if (chargeResult.IsFailure)
            return chargeResult;

        posDb.CustomerWalletTransactions.Add(new CustomerWalletTransaction(
            customer.Id, isWallet ? "redeem" : "house_charge", amount, orderId, null));
        await posDb.SaveChangesAsync(ct);

        return Result.Success();
    }
}
