namespace Softaxis.Finance.Infrastructure.Integrations;

/// <summary>How a transaction type reaches the ledger today.</summary>
internal static class IntegrationKind
{
    /// <summary>Posted by Finance itself, in the same transaction as the document. Fixed accounts.</summary>
    public const string Native = "native";

    /// <summary>Collected from another module into the posting queue and posted from there.</summary>
    public const string Queue = "queue";

    /// <summary>The browser creates the Finance document through the Finance API. Nothing server-side
    /// guarantees it happens, so it is monitored here but not driven from here.</summary>
    public const string Client = "client";

    /// <summary>Nothing reaches the ledger.</summary>
    public const string None = "none";
}

/// <summary>One side of the journal entry an integration raises.</summary>
/// <param name="Role">Stable key; also the key of the amount in a collected document.</param>
/// <param name="IsDebit">Which side a positive amount lands on.</param>
/// <param name="DefaultAccountNumber">Used until the workspace maps the role to another account.</param>
internal sealed record PostingRole(string Role, string Label, bool IsDebit, string DefaultAccountNumber);

internal sealed record IntegrationDefinition(
    string Key,
    string Module,         // frontend module key that owns the source documents
    string Name,
    string Kind,
    string Trigger,        // the business event that should raise the entry
    string Notes,          // what is true today, including the gaps
    IReadOnlyList<PostingRole> Roles,
    // False: never posted without a person looking, whatever the workspace's mode says.
    bool AutoAllowed = true,
    // True: nothing is posted ON PURPOSE (the ledger is already covered elsewhere, or the module
    // records no money). Shown as "Not needed", not as a broken link, and no "documents not in
    // the ledger" count is reported — those documents are not supposed to be there.
    bool ByDesign = false);

/// <summary>
/// Every transaction type that does, or should, reach the General Ledger.
///
/// <para>Written from an audit of the code, not from intent: a <see cref="IntegrationKind.Native"/>
/// entry names a handler that calls <c>GlPoster</c>; a <see cref="IntegrationKind.None"/> entry is
/// a module whose handlers were read and found to post nothing.</para>
/// </summary>
internal static class IntegrationCatalogue
{
    private static PostingRole Dr(string role, string label, string account) => new(role, label, true, account);
    private static PostingRole Cr(string role, string label, string account) => new(role, label, false, account);

    public static readonly IReadOnlyList<IntegrationDefinition> All =
    [
        // ── Finance's own documents ──────────────────────────────────────────
        new("finance.invoice", "finance", "Sales invoices", IntegrationKind.Native,
            "Invoice sent",
            "Posted when the invoice is sent (manually or by schedule); reversed on cancel or reset.",
            [Dr("receivable", "Accounts receivable", "1200"), Cr("revenue", "Sales revenue", "4001"), Cr("tax", "VAT payable", "2200")]),

        new("finance.invoice-payment", "finance", "Invoice payments", IntegrationKind.Native,
            "Invoice marked paid",
            "Posted when a payment is recorded on an invoice. Cash or bank is chosen by payment method.",
            [Dr("cash", "Cash on hand", "1001"), Dr("bank", "Bank", "1010"), Cr("receivable", "Accounts receivable", "1200")]),

        new("finance.receipt-voucher", "finance", "Receipt vouchers", IntegrationKind.Native,
            "Voucher posted",
            "Posted with realised exchange gain or loss; reversed on void.",
            [Dr("cash", "Cash on hand", "1001"), Dr("bank", "Bank", "1010"), Cr("receivable", "Accounts receivable", "1200"), Cr("fx", "Exchange gain/loss", "4950")]),

        new("finance.purchase-bill", "finance", "Purchase bills", IntegrationKind.Native,
            "Bill approved",
            "Posted on approval; reversed on cancel. Purchases are expensed — stock is not carried in the ledger.",
            [Dr("purchases", "Purchases / cost of goods", "5400"), Dr("tax", "VAT payable", "2200"), Cr("payable", "Accounts payable", "2001")]),

        new("finance.payment-voucher", "finance", "Payment vouchers", IntegrationKind.Native,
            "Voucher posted",
            "Posted with realised exchange gain or loss; reversed on void.",
            [Dr("payable", "Accounts payable", "2001"), Cr("cash", "Cash on hand", "1001"), Cr("bank", "Bank", "1010"), Cr("fx", "Exchange gain/loss", "4950")]),

        new("finance.expense", "finance", "Expenses", IntegrationKind.Native,
            "Expense marked paid",
            "Posted when paid. The expense account comes from the category unless one is chosen on the expense.",
            [Dr("expense", "Expense account (by category)", "5900"), Cr("cash", "Cash on hand", "1001"), Cr("bank", "Bank", "1010")]),

        new("finance.bank-transaction", "finance", "Bank transactions", IntegrationKind.None,
            "Deposit, withdrawal or transfer recorded",
            "Bank transactions change the bank account balance only. No journal entry is raised, so the bank balance and ledger account 1010 can drift apart. They are deliberately not posted from here: a bank line has only one side (nothing says what the money was for), bank accounts are not tied to ledger accounts, and receipt and payment vouchers already post the same money — posting both would count it twice. The way to close the gap is bank reconciliation.",
            []),

        // ── Collected from other modules ─────────────────────────────────────
        new("pos.sale", "pos", "Retail POS sales", IntegrationKind.Queue,
            "Sale completed at the till",
            "Each completed sale is collected once. A sale later refunded is still posted in full; the refund is posted separately. Sales paid from store credit go to the customer-balances account, not the bank.",
            [Dr("cash", "Cash takings", "1001"), Dr("bank", "Card, cheque and transfer takings", "1010"), Dr("customer", "Paid from customer balances (store credit)", "1200"), Cr("revenue", "Sales revenue", "4001"), Cr("tax", "Sales tax collected", "2200")]),

        new("pos.wallet", "pos", "Customer wallet top-ups and account payments", IntegrationKind.Queue,
            "Top-up or house-account payment taken",
            "Money a customer pays in ahead of buying (wallet top-up) or against their house account: cash or bank is debited and customer balances credited. Spending the balance is posted by the sale or order that used it. Rows from before the payment method was recorded are held.",
            [Dr("cash", "Cash received", "1001"), Dr("bank", "Card, cheque or transfer received", "1010"), Cr("customer", "Customer balances (wallet, house account)", "1200")]),

        new("pos.cash", "pos", "Till cash in and out", IntegrationKind.Queue,
            "Cash put into or taken out of a till",
            "Each movement is posted by what it was for: owner deposit, cash banked, float from the bank, petty-cash expense, owner withdrawal. Movements recorded before a purpose was required are held.",
            [Dr("cashIn", "Cash into the till", "1001"), Cr("cashOut", "Cash out of the till", "1001"),
             Dr("bankIn", "Cash banked", "1010"), Cr("bankOut", "Float taken from the bank", "1010"),
             Dr("expense", "Petty cash expense", "5900"),
             Cr("equityIn", "Owner deposit", "3001"), Dr("equityOut", "Owner withdrawal", "3100")]),

        new("pos.refund", "pos", "Retail POS refunds", IntegrationKind.Queue,
            "Refund completed at the till",
            "Reverses revenue and tax for the refunded amount and credits whichever of cash, bank or store credit the refund was paid back through.",
            [Dr("revenue", "Sales revenue (returns)", "4001"), Dr("tax", "Sales tax collected", "2200"), Cr("cash", "Cash refunded", "1001"), Cr("bank", "Refunded to card or bank", "1010"), Cr("customer", "Refunded to customer balances (store credit)", "1200")]),

        new("restaurant.order", "restaurant", "Restaurant orders", IntegrationKind.Queue,
            "Order paid in full",
            "Collected when the order reaches paid. Tips are held as a liability, not revenue. Wallet and house-account payments go to the customer-balances account, not the bank.",
            [Dr("cash", "Cash takings", "1001"), Dr("bank", "Card and bank takings", "1010"), Dr("customer", "Paid from customer balances (wallet, house account)", "1200"), Cr("revenue", "Food and beverage revenue", "4001"), Cr("tax", "Sales tax collected", "2200"), Cr("tips", "Tips payable to staff", "2400")]),

        new("restaurant.refund", "restaurant", "Restaurant refunds", IntegrationKind.Queue,
            "Refund recorded on a paid order",
            "Posted against revenue for the refunded amount. Tax is not split out — a refund row stores one amount.",
            [Dr("revenue", "Food and beverage revenue (returns)", "4001"), Cr("cash", "Cash refunded", "1001"), Cr("bank", "Refunded to card or bank", "1010"), Cr("customer", "Refunded to customer balances (wallet, house account)", "1200")]),

        new("realestate.rent", "real-estate", "Rent received", IntegrationKind.Queue,
            "Rent installment fully paid",
            "Collected when an installment is settled. Part payments are posted once the installment is paid in full.",
            [Dr("cash", "Cash received", "1001"), Dr("bank", "Cheque or bank received", "1010"), Cr("revenue", "Rental income", "4002")]),

        new("library.fine", "library", "Library fines collected", IntegrationKind.Queue,
            "Fine payment taken",
            "Each amount taken against a fine is collected once, part payments included. Waived fines are not posted. A payment posted here is marked in the library, so its own fines posting screen cannot enter it again — and the reverse.",
            [Dr("cash", "Cash received", "1001"), Dr("bank", "Card or bank received", "1010"), Cr("revenue", "Fines and other income", "4900")]),

        new("hr.payroll", "hr", "Payroll", IntegrationKind.Queue,
            "Payroll run approved by Finance",
            "Collects approved runs that have no journal entry yet — the browser-side posting at approval silently skips when it cannot find salary accounts by name. Once posted here the entry is linked back to the run.",
            [Dr("expense", "Salaries and wages", "5001"), Cr("payable", "Net salaries payable", "2100"), Cr("deductions", "Deductions withheld", "2400")]),

        // ── Browser-orchestrated ─────────────────────────────────────────────
        new("manufacturing.production", "manufacturing", "Production cost", IntegrationKind.Client,
            "Production order completed",
            "A user posts a draft journal entry from the order drawer. Completed orders with no entry are counted here.",
            []),

        new("visa.invoice", "visa", "Visa case invoices", IntegrationKind.Client,
            "Case created",
            "A draft invoice is created through the Finance API when the box is ticked. It reaches the ledger only when someone sends it.",
            []),

        new("sales.quotation", "sales", "Quotation to invoice", IntegrationKind.Client,
            "Quotation converted",
            "A user creates a Finance invoice from the quotation. Sales orders and delivery challans post nothing.",
            []),

        // ── Not connected ────────────────────────────────────────────────────
        new("sales.return", "sales", "Sales returns", IntegrationKind.Queue,
            "Return approved",
            "Collected when a return is approved: sales returns are debited and accounts receivable credited (a credit note against the customer). Item prices are taken as before tax, and a return is not tied to an invoice, so VAT is not reversed here — adjust it on the credit note. Never posted automatically.",
            [Dr("revenue", "Sales returns and credit notes", "4001"), Cr("receivable", "Accounts receivable (credit note)", "1200")],
            AutoAllowed: false),

        new("purchase.grn", "purchase", "Goods receipts and purchase returns", IntegrationKind.None,
            "Goods received or returned",
            "Already covered: the purchase reaches the ledger when the supplier's purchase invoice is approved (Purchases debited, Accounts payable credited). Posting the goods receipt as well would count the same goods twice. Stock is not carried as an asset in the ledger, so receipts and returns change the purchase order and stock levels only.",
            [], ByDesign: true),

        new("inventory.movement", "inventory", "Stock adjustments and write-offs", IntegrationKind.None,
            "Stock adjusted, written off or transferred",
            "Not needed with the current method: purchases are expensed when the purchase invoice is approved, and stock is not carried as an asset in the ledger, so there is no inventory account for an adjustment to move. Stock quantities are still tracked in Inventory.",
            [], ByDesign: true),

        new("hospitality.booking", "hospitality", "Hotel guest payments", IntegrationKind.Queue,
            "Payment taken from a guest",
            "Each payment against a booking is collected once: cash or bank is debited and revenue credited. A deposit taken before the stay is treated as revenue here, not as a liability — change the account in the mapping if your accountant wants advance deposits held until check-in. Payments recorded before individual payments were kept are not posted.",
            [Dr("cash", "Cash received", "1001"), Dr("bank", "Card, cheque or transfer received", "1010"), Cr("revenue", "Room revenue and guest payments", "4001")]),

        new("construction.project", "construction", "Construction contracts", IntegrationKind.None,
            "Progress billed or contractor paid",
            "Nothing to post: Construction records a contract's total value and a project's budget, but no progress bills, client invoices or contractor payments. Bill the client with a Finance invoice and pay contractors with a payment voucher or purchase invoice — those post to the ledger.",
            [], ByDesign: true),
    ];

    public static IntegrationDefinition? Find(string key) =>
        All.FirstOrDefault(d => string.Equals(d.Key, key, StringComparison.OrdinalIgnoreCase));
}
