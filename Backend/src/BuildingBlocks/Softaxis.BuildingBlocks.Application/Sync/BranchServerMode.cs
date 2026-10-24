using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.BuildingBlocks.Application.Sync;

/// <summary>
/// True on a branch server (<c>BranchSync:Mode = Branch</c>). Set once at startup; false on every other deployment.
///
/// <para>
/// <b>Customer balances belong to head office.</b> Wallet (store credit), house-account credit and loyalty points are
/// one balance spent at any branch, and the customer record itself is head-office data that flows DOWN. A branch
/// server holds only a copy, so spending or changing it there would either be overwritten by the next sync or be
/// spent twice at two branches. So a branch server refuses those tenders, does not earn or redeem points, and does
/// not create or edit customers - the same rule Square and Toast apply to stored value in offline mode.
/// Decision 2 and 3 in <c>docs/branch-server-design.md</c> §12.
/// </para>
/// </summary>
public static class BranchServerMode
{
    public static bool IsBranch { get; set; }

    public static Error BalanceRefusal(string what) => Error.Custom("Branch.Conflict",
        $"{what} is not available at a branch server: customer balances are kept at head office. Take another payment method.");

    public static Error CustomerRefusal() => Error.Custom("Branch.Conflict",
        "Customers are added and changed at head office. New ones appear here after the next sync (within a minute when online).");
}
