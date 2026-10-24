namespace Softaxis.Finance.Infrastructure.Integrations;

/// <summary>One row read from another module's table. A1–A7 mean whatever the source says they do.</summary>
internal sealed class SourceRow
{
    public Guid    Id          { get; init; }
    public string  Number      { get; init; } = string.Empty;
    public string  Date        { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal A1 { get; init; }
    public decimal A2 { get; init; }
    public decimal A3 { get; init; }
    public decimal A4 { get; init; }
    public decimal A5 { get; init; }
    public decimal A6 { get; init; }
    public decimal A7 { get; init; }
}

/// <summary>
/// How to read one transaction type out of its owning module's schema.
///
/// <para>Finance reads; it never writes into another module's tables from here. Every module
/// shares one physical database (separate schemas), which is what makes a plain cross-schema read
/// possible — the same arrangement the restaurant till uses to read POS shifts.</para>
///
/// <para><b>Tenant scoping is by hand.</b> Raw SQL bypasses EF's global filter, so every
/// <see cref="FromWhere"/> must compare its tenant column to <c>{0}</c>. <c>{1}</c> is the
/// earliest date to collect (yyyy-MM-dd).</para>
///
/// <para><b>Nothing is guessed.</b> <see cref="Amounts"/> does not clamp or repair figures. A
/// document whose own figures disagree, or that was paid in a way there is no posting rule for,
/// is reported by <see cref="Check"/> and held for a person — a plausible-looking entry built
/// from wrong data is worse than no entry.</para>
/// </summary>
/// <param name="Check">A reason this document must not be posted as it stands, or null.</param>
/// <param name="CancelledWhere">SQL condition (same aliases as <see cref="FromWhere"/>) that is
/// true for a document cancelled after it could have been posted. Null = it cannot happen.</param>
/// <param name="CancelledFrom">The FROM clause <see cref="CancelledWhere"/> applies to.</param>
internal sealed record PostingSource(
    string Key,
    string IdExpr,
    string Select,
    string FromWhere,
    string OrderBy,
    Func<SourceRow, Dictionary<string, decimal>> Amounts,
    Func<SourceRow, string?>? Check = null,
    string? CancelledFrom = null,
    string? CancelledWhere = null);

internal static class PostingSources
{
    /// <summary>What a cent of rounding between a document's own figures may explain.</summary>
    private const decimal Cent = 0.01m;

    private static string Zero(params string[] columns) =>
        string.Join(", ", columns.Select(c => $"CAST(0 AS decimal(18,2)) AS {c}"));

    // ── POS payment methods (Softaxis.POS.Domain.Enums.PaymentMethod) ────────
    // 1 Cash · 2 Card · 3 DigitalWallet · 5 Cheque · 7 BankTransfer reach a bank or processor.
    // 4 StoreCredit is the customer's own balance, and 8 HouseAccount is a sale bought on credit:
    // no money arrives with either.
    // 6 Mixed (and anything added later) says nothing about where the money went.
    private const string PosBank     = "p.[Method] IN (2, 3, 5, 7)";
    private const string PosCustomer = "p.[Method] IN (4, 8)";
    private const string PosUnknown  = "p.[Method] NOT IN (1, 2, 3, 4, 5, 7, 8)";

    private static string PosPayments(string condition, string alias, bool unsigned = false) =>
        $"ISNULL((SELECT SUM({(unsigned ? "ABS(p.[Amount])" : "p.[Amount]")}) FROM [pos].[pos_payments] p WHERE p.[TransactionId] = t.[Id] AND {condition}), 0) AS {alias}";

    // ── Restaurant payment methods (free text on the payment row) ────────────
    private const string RestMethod   = "LOWER(LTRIM(RTRIM(ISNULL({0}.[Method], ''))))";
    private const string RestBankList = "('card', 'bank transfer', 'bank_transfer', 'cheque', 'online', 'digital wallet')";
    private const string RestCustList = "('wallet', 'house account')";

    private static string RestIs(string alias, string kind) => kind switch
    {
        "cash"     => $"{string.Format(RestMethod, alias)} = 'cash'",
        "bank"     => $"{string.Format(RestMethod, alias)} IN {RestBankList}",
        "customer" => $"{string.Format(RestMethod, alias)} IN {RestCustList}",
        _          => $"({string.Format(RestMethod, alias)} <> 'cash' AND {string.Format(RestMethod, alias)} NOT IN {RestBankList} AND {string.Format(RestMethod, alias)} NOT IN {RestCustList})",
    };

    private static string RestPayments(string condition, string alias) =>
        $"ISNULL((SELECT SUM(p.[Amount]) FROM [restaurant].[OrderPayments] p WHERE p.[OrderId] = o.[Id] AND {condition}), 0) AS {alias}";

    /// <summary>The day the order was settled: its last payment, not whenever the row was last touched.</summary>
    private const string RestOrderDate =
        "CONVERT(varchar(10), COALESCE((SELECT MAX(p.[CreatedAt]) FROM [restaurant].[OrderPayments] p WHERE p.[OrderId] = o.[Id]), o.[UpdatedAt], o.[CreatedAt]), 23)";

    /// <summary>1 cash · 2 bank · 3 customer balance · 0 no rule.</summary>
    private static string Kind(string cash, string bank, string? customer = null) =>
        $"CAST(CASE WHEN {cash} THEN 1 WHEN {bank} THEN 2 {(customer is null ? "" : $"WHEN {customer} THEN 3 ")}ELSE 0 END AS decimal(18,2))";

    private const string PosDate = "CONVERT(varchar(10), COALESCE(t.[CompletedAt], t.[CreatedAt]), 23)";

    public static readonly IReadOnlyList<PostingSource> All =
    [
        // A sale that was later refunded is voided with the note "Refunded via <number>" — it was
        // still a real sale, and its refund is collected separately, so it must stay in.
        new("pos.sale",
            IdExpr: "t.[Id]",
            Select: $"""
                t.[Id], t.[TransactionNumber] AS [Number], {PosDate} AS [Date],
                CAST(NULL AS nvarchar(200)) AS [Description],
                t.[TotalAmount] AS A1, t.[TaxAmount] AS A2,
                {PosPayments(PosBank, "A3")}, {PosPayments(PosCustomer, "A4")},
                {PosPayments(PosUnknown, "A5")}, {PosPayments("1 = 1", "A6")}, {Zero("A7")}
                """,
            FromWhere: $"""
                FROM [pos].[pos_transactions] t
                WHERE t.[TenantId] = {"{0}"} AND t.[IsDeleted] = 0 AND t.[Type] = 1
                  AND (t.[Status] IN (2, 4) OR (t.[Status] = 3 AND t.[Notes] LIKE 'Refunded via%'))
                  AND {PosDate} >= {"{1}"}
                """,
            OrderBy: "t.[CreatedAt]",
            Amounts: r => new()
            {
                ["cash"] = r.A1 - r.A3 - r.A4, ["bank"] = r.A3, ["customer"] = r.A4,
                ["revenue"] = r.A1 - r.A2, ["tax"] = r.A2,
            },
            Check: r =>
                r.A1 <= 0                    ? $"The sale total is {r.A1:0.00}." :
                r.A2 < 0 || r.A2 > r.A1      ? $"Tax {r.A2:0.00} does not fit a sale of {r.A1:0.00}." :
                r.A5 > 0                     ? $"{r.A5:0.00} was taken by a payment method there is no posting rule for." :
                r.A3 + r.A4 > r.A1 + Cent    ? $"Card, bank and store-credit payments ({r.A3 + r.A4:0.00}) are more than the sale ({r.A1:0.00})." :
                r.A6 < r.A1 - Cent           ? $"The payments recorded ({r.A6:0.00}) do not cover the sale ({r.A1:0.00})." :
                null,
            // A sale voided outright (not through a refund) never happened as far as the books go.
            CancelledFrom: "FROM [pos].[pos_transactions] t",
            CancelledWhere: "(t.[IsDeleted] = 1 OR (t.[Status] = 3 AND (t.[Notes] IS NULL OR t.[Notes] NOT LIKE 'Refunded via%')))"),

        // Spending a wallet or house balance is already in the sale or order that used it; this is the
        // money coming in. The payment method is recorded on the row, so cash and bank are told apart.
        new("pos.wallet",
            IdExpr: "w.[Id]",
            Select: $"""
                w.[Id],
                CAST(CASE w.[Type] WHEN 'topup' THEN 'WLT-' ELSE 'HPY-' END + UPPER(LEFT(CAST(w.[Id] AS varchar(36)), 8)) AS nvarchar(100)) AS [Number],
                CONVERT(varchar(10), w.[CreatedAt], 23) AS [Date],
                CAST(LEFT(CASE w.[Type] WHEN 'topup' THEN N'Wallet top-up' ELSE N'House account payment' END + N' — ' + ISNULL(c.[Name], N''), 200) AS nvarchar(200)) AS [Description],
                w.[Amount] AS A1,
                {Kind("LOWER(ISNULL(w.[PaymentMethod], '')) = 'cash'", "LOWER(ISNULL(w.[PaymentMethod], '')) IN ('card', 'bank_transfer', 'cheque')")} AS A2,
                {Zero("A3", "A4", "A5", "A6", "A7")}
                """,
            FromWhere: """
                FROM [pos].[customer_wallet_transactions] w
                LEFT JOIN [pos].[customers] c ON c.[Id] = w.[CustomerId]
                WHERE w.[TenantId] = {0} AND w.[Type] IN ('topup', 'house_payment') AND w.[Amount] > 0
                  AND CONVERT(varchar(10), w.[CreatedAt], 23) >= {1}
                """,
            OrderBy: "w.[CreatedAt]",
            Amounts: r => new() { [r.A2 == 1 ? "cash" : "bank"] = r.A1, ["customer"] = r.A1 },
            Check: r => r.A2 == 0 ? "How the customer paid was not recorded (or is not a method there is a posting rule for), so it is not known whether cash or the bank received it." : null),

        // The category says what the other side is. A direction that does not fit the category is held.
        new("pos.cash",
            IdExpr: "m.[Id]",
            Select: $"""
                m.[Id], CAST('CASH-' + UPPER(LEFT(CAST(m.[Id] AS varchar(36)), 8)) AS nvarchar(100)) AS [Number],
                CONVERT(varchar(10), m.[CreatedAt], 23) AS [Date],
                CAST(LEFT(CASE WHEN m.[Type] = 1 THEN N'Cash in — ' ELSE N'Cash out — ' END + ISNULL(m.[Reason], N''), 200) AS nvarchar(200)) AS [Description],
                m.[Amount] AS A1,
                CAST(CASE
                    WHEN m.[Type] = 1 AND m.[Category] = 'owner_deposit'    THEN 1
                    WHEN m.[Type] = 1 AND m.[Category] = 'bank_withdrawal'  THEN 2
                    WHEN m.[Type] = 2 AND m.[Category] = 'bank_deposit'     THEN 3
                    WHEN m.[Type] = 2 AND m.[Category] = 'petty_expense'    THEN 4
                    WHEN m.[Type] = 2 AND m.[Category] = 'owner_withdrawal' THEN 5
                    ELSE 0 END AS decimal(18,2)) AS A2,
                {Zero("A3", "A4", "A5", "A6", "A7")}
                """,
            FromWhere: """
                FROM [pos].[cash_movements] m
                WHERE m.[TenantId] = {0} AND m.[IsDeleted] = 0 AND m.[Amount] > 0
                  AND CONVERT(varchar(10), m.[CreatedAt], 23) >= {1}
                """,
            OrderBy: "m.[CreatedAt]",
            Amounts: r => r.A2 switch
            {
                1 => new() { ["cashIn"] = r.A1, ["equityIn"] = r.A1 },
                2 => new() { ["cashIn"] = r.A1, ["bankOut"] = r.A1 },
                3 => new() { ["cashOut"] = r.A1, ["bankIn"] = r.A1 },
                4 => new() { ["cashOut"] = r.A1, ["expense"] = r.A1 },
                5 => new() { ["cashOut"] = r.A1, ["equityOut"] = r.A1 },
                _ => new() { ["cashIn"] = r.A1 },   // never posted: Check holds it
            },
            Check: r => r.A2 == 0 ? "What the cash was for was not recorded, or does not fit the direction, so the other side of the entry is unknown." : null,
            CancelledFrom: "FROM [pos].[cash_movements] m",
            CancelledWhere: "m.[IsDeleted] = 1"),

        new("hospitality.booking",
            IdExpr: "p.[Id]",
            Select: $"""
                p.[Id], CAST(b.[BookingNumber] + '/' + UPPER(LEFT(CAST(p.[Id] AS varchar(36)), 4)) AS nvarchar(100)) AS [Number],
                CAST(LEFT(p.[PaidOn], 10) AS varchar(10)) AS [Date],
                CAST(LEFT(b.[GuestName] + N' — room ' + b.[RoomNumber], 200) AS nvarchar(200)) AS [Description],
                p.[Amount] AS A1,
                {Kind("LOWER(p.[Method]) = 'cash'", "LOWER(p.[Method]) IN ('card', 'bank_transfer', 'cheque')")} AS A2,
                {Zero("A3", "A4", "A5", "A6", "A7")}
                """,
            FromWhere: """
                FROM [hospitality].[BookingPayments] p
                JOIN [hospitality].[Bookings] b ON b.[Id] = p.[BookingId]
                WHERE p.[TenantId] = {0} AND b.[IsDeleted] = 0 AND p.[Amount] > 0
                  AND LEFT(p.[PaidOn], 10) >= {1}
                """,
            OrderBy: "p.[CreatedAt]",
            Amounts: r => new() { [r.A2 == 1 ? "cash" : "bank"] = r.A1, ["revenue"] = r.A1 },
            Check: r => r.A2 == 0 ? "How the guest paid was not recorded as cash or a bank method, so it is not known where the money went." : null,
            // A cancelled booking may owe the guest a refund; nothing here knows, so a person is told.
            CancelledFrom: "FROM [hospitality].[BookingPayments] p JOIN [hospitality].[Bookings] b ON b.[Id] = p.[BookingId]",
            CancelledWhere: "(b.[IsDeleted] = 1 OR b.[Status] = 'cancelled')"),

        // Travel agency: money received from the customer.
        new("tours.payment",
            IdExpr: "p.[Id]",
            Select: $"""
                p.[Id], CAST(b.[BookingNumber] + '/' + UPPER(LEFT(CAST(p.[Id] AS varchar(36)), 4)) AS nvarchar(100)) AS [Number],
                CAST(LEFT(p.[PaidOn], 10) AS varchar(10)) AS [Date],
                CAST(LEFT(b.[CustomerName] + N' — ' + b.[Title], 200) AS nvarchar(200)) AS [Description],
                p.[Amount] AS A1,
                {Kind("LOWER(p.[Method]) = 'cash'", "LOWER(p.[Method]) IN ('card', 'bank_transfer', 'cheque', 'online')")} AS A2,
                {Zero("A3", "A4", "A5", "A6", "A7")}
                """,
            FromWhere: """
                FROM [hospitality].[TourPayments] p
                JOIN [hospitality].[TourBookings] b ON b.[Id] = p.[TourBookingId]
                WHERE p.[TenantId] = {0} AND p.[IsVoided] = 0 AND p.[Amount] > 0
                  AND LEFT(p.[PaidOn], 10) >= {1}
                """,
            OrderBy: "p.[CreatedAt]",
            Amounts: r => new() { [r.A2 == 1 ? "cash" : "bank"] = r.A1, ["customer"] = r.A1 },
            Check: r => r.A2 == 0 ? "How the customer paid was not recorded as cash or a bank method, so it is not known where the money went." : null,
            CancelledFrom: "FROM [hospitality].[TourPayments] p",
            CancelledWhere: "p.[IsVoided] = 1"),

        // Travel agency: the trip itself, once completed. A1 total, A2 tax, A3 supplier cost.
        new("tours.trip",
            IdExpr: "b.[Id]",
            Select: """
                b.[Id], b.[BookingNumber] AS [Number], CAST(b.[EndDate] AS varchar(10)) AS [Date],
                CAST(LEFT(b.[CustomerName] + N' — ' + b.[Title], 200) AS nvarchar(200)) AS [Description],
                b.[TotalAmount] AS A1, b.[TaxAmount] AS A2, b.[CostAmount] AS A3,
                CAST(0 AS decimal(18,2)) AS A4, CAST(0 AS decimal(18,2)) AS A5, CAST(0 AS decimal(18,2)) AS A6, CAST(0 AS decimal(18,2)) AS A7
                """,
            FromWhere: """
                FROM [hospitality].[TourBookings] b
                WHERE b.[TenantId] = {0} AND b.[IsDeleted] = 0 AND b.[Status] = 'completed'
                  AND (b.[TotalAmount] > 0 OR b.[CostAmount] > 0)
                  AND b.[EndDate] >= {1}
                """,
            OrderBy: "b.[EndDate]",
            Amounts: r => new()
            {
                ["customer"] = r.A1, ["revenue"] = r.A1 - r.A2, ["tax"] = r.A2,
                ["cost"] = r.A3, ["payable"] = r.A3,
            },
            Check: r =>
                r.A2 > r.A1 ? $"Tax {r.A2:0.00} is more than the trip total ({r.A1:0.00})." :
                r.A1 < 0 || r.A3 < 0 ? "The trip has a negative amount." : null,
            CancelledFrom: "FROM [hospitality].[TourBookings] b",
            CancelledWhere: "(b.[IsDeleted] = 1 OR b.[Status] <> 'completed')"),

        new("pos.refund",
            IdExpr: "t.[Id]",
            Select: $"""
                t.[Id], t.[TransactionNumber] AS [Number], {PosDate} AS [Date],
                CAST(NULL AS nvarchar(200)) AS [Description],
                ABS(t.[TotalAmount]) AS A1, ABS(t.[TaxAmount]) AS A2,
                {PosPayments(PosBank, "A3", unsigned: true)},
                {PosPayments(PosCustomer, "A4", unsigned: true)},
                {PosPayments(PosUnknown, "A5", unsigned: true)},
                {PosPayments("1 = 1", "A6", unsigned: true)}, {Zero("A7")}
                """,
            FromWhere: $"""
                FROM [pos].[pos_transactions] t
                WHERE t.[TenantId] = {"{0}"} AND t.[IsDeleted] = 0 AND t.[Type] = 2 AND t.[Status] = 2
                  AND {PosDate} >= {"{1}"}
                """,
            OrderBy: "t.[CreatedAt]",
            Amounts: r => new()
            {
                ["revenue"] = r.A1 - r.A2, ["tax"] = r.A2,
                ["cash"] = r.A1 - r.A3 - r.A4, ["bank"] = r.A3, ["customer"] = r.A4,
            },
            Check: r =>
                r.A1 <= 0                    ? "The refund has no amount." :
                r.A2 > r.A1                  ? $"Tax {r.A2:0.00} is more than the refund ({r.A1:0.00})." :
                r.A5 > 0                     ? $"{r.A5:0.00} was refunded by a payment method there is no posting rule for." :
                r.A3 + r.A4 > r.A1 + Cent    ? $"Card, bank and store-credit refunds ({r.A3 + r.A4:0.00}) are more than the refund ({r.A1:0.00})." :
                r.A6 < r.A1 - Cent           ? $"The refund does not say how {r.A1 - r.A6:0.00} of it was paid back." :
                null,
            CancelledFrom: "FROM [pos].[pos_transactions] t",
            CancelledWhere: "(t.[IsDeleted] = 1 OR t.[Status] = 3)"),

        // A split parent holds no items once split (its total is zero) and its children are
        // collected on their own, so it is left out rather than queued as an empty document.
        new("restaurant.order",
            IdExpr: "o.[Id]",
            Select: $"""
                o.[Id], o.[OrderNumber] AS [Number], {RestOrderDate} AS [Date],
                CAST(o.[OrderType] AS nvarchar(200)) AS [Description],
                o.[Total] AS A1, o.[TaxAmount] AS A2, o.[TipAmount] AS A3,
                {RestPayments(RestIs("p", "bank"), "A4")}, {RestPayments(RestIs("p", "customer"), "A5")},
                {RestPayments(RestIs("p", "unknown"), "A6")}, {RestPayments("1 = 1", "A7")}
                """,
            FromWhere: $"""
                FROM [restaurant].[Orders] o
                WHERE o.[TenantId] = {"{0}"} AND o.[IsDeleted] = 0 AND o.[Status] = 'paid'
                  AND (o.[Total] + o.[TipAmount]) > 0
                  AND {RestOrderDate} >= {"{1}"}
                """,
            OrderBy: "o.[CreatedAt]",
            Amounts: r =>
            {
                var due = r.A1 + r.A3;
                return new()
                {
                    ["cash"] = due - r.A4 - r.A5, ["bank"] = r.A4, ["customer"] = r.A5,
                    ["revenue"] = r.A1 - r.A2, ["tax"] = r.A2, ["tips"] = r.A3,
                };
            },
            Check: r =>
            {
                var due = r.A1 + r.A3;
                return r.A1 < 0 || r.A3 < 0         ? $"The order total is {r.A1:0.00} and the tip {r.A3:0.00}." :
                       r.A2 < 0 || r.A2 > r.A1      ? $"Tax {r.A2:0.00} does not fit an order of {r.A1:0.00}." :
                       r.A6 > 0                     ? $"{r.A6:0.00} was taken by a payment method there is no posting rule for." :
                       r.A4 + r.A5 > due + Cent     ? $"Card, bank and customer-account payments ({r.A4 + r.A5:0.00}) are more than the bill ({due:0.00})." :
                       r.A7 < due - Cent            ? $"The payments recorded ({r.A7:0.00}) do not cover the bill ({due:0.00})." :
                       null;
            },
            CancelledFrom: "FROM [restaurant].[Orders] o",
            CancelledWhere: "(o.[IsDeleted] = 1 OR o.[Status] = 'cancelled')"),

        new("restaurant.refund",
            IdExpr: "f.[Id]",
            Select: $"""
                f.[Id], CAST(o.[OrderNumber] + '-R' AS nvarchar(100)) AS [Number],
                CONVERT(varchar(10), f.[CreatedAt], 23) AS [Date],
                CAST(f.[Reason] AS nvarchar(200)) AS [Description],
                f.[Amount] AS A1,
                {Kind(RestIs("f", "cash"), RestIs("f", "bank"), RestIs("f", "customer"))} AS A2,
                {Zero("A3", "A4", "A5", "A6", "A7")}
                """,
            FromWhere: """
                FROM [restaurant].[OrderRefunds] f
                JOIN [restaurant].[Orders] o ON o.[Id] = f.[OrderId]
                WHERE f.[TenantId] = {0} AND o.[IsDeleted] = 0 AND f.[Amount] > 0
                  AND CONVERT(varchar(10), f.[CreatedAt], 23) >= {1}
                """,
            OrderBy: "f.[CreatedAt]",
            Amounts: r => new() { ["revenue"] = r.A1, [r.A2 == 1 ? "cash" : r.A2 == 3 ? "customer" : "bank"] = r.A1 },
            Check: r => r.A2 == 0 ? "The refund was paid back by a method there is no posting rule for." : null),

        // The renter is this table's "TenantId"; the workspace column is OwnerTenantId.
        new("realestate.rent",
            IdExpr: "i.[Id]",
            Select: $"""
                i.[Id], CAST(c.[ContractNumber] + '/' + CAST(i.[InstallmentNumber] AS varchar(10)) AS nvarchar(100)) AS [Number],
                CAST(LEFT(COALESCE(NULLIF(i.[PaidDate], ''), i.[DueDate]), 10) AS varchar(10)) AS [Date],
                CAST(LEFT(c.[TenantName] + N' — ' + c.[PropertyName], 200) AS nvarchar(200)) AS [Description],
                i.[AmountPaid] AS A1,
                {Kind("LOWER(ISNULL(i.[PaymentMethod], '')) = 'cash'", "LOWER(ISNULL(i.[PaymentMethod], '')) IN ('cheque', 'bank_transfer', 'bank transfer', 'card', 'online')")} AS A2,
                {Zero("A3", "A4", "A5", "A6", "A7")}
                """,
            FromWhere: """
                FROM [real_estate].[RentInstallments] i
                JOIN [real_estate].[LeaseContracts] c ON c.[Id] = i.[ContractId]
                WHERE i.[OwnerTenantId] = {0} AND i.[IsDeleted] = 0 AND c.[IsDeleted] = 0
                  AND i.[Status] = 'paid' AND i.[AmountPaid] > 0
                  AND LEFT(COALESCE(NULLIF(i.[PaidDate], ''), i.[DueDate]), 10) >= {1}
                """,
            OrderBy: "i.[DueDate]",
            Amounts: r => new() { [r.A2 == 1 ? "cash" : "bank"] = r.A1, ["revenue"] = r.A1 },
            Check: r => r.A2 == 0 ? "The payment has no method, or one there is no posting rule for, so it is not known whether cash or the bank received it." : null),

        // One row per amount taken, not per fine: a fine can be paid in parts, and the library's
        // own "post fines" screen marks the same rows — whichever posts a payment first, the
        // other no longer sees it (JournalEntryId is filled).
        new("library.fine",
            IdExpr: "p.[Id]",
            Select: $"""
                p.[Id], CAST('FINE-' + UPPER(LEFT(CAST(p.[Id] AS varchar(36)), 8)) AS nvarchar(100)) AS [Number],
                CAST(LEFT(p.[PaidOn], 10) AS varchar(10)) AS [Date],
                CAST(LEFT(f.[Type] + N' — ' + ISNULL(f.[Title], N''), 200) AS nvarchar(200)) AS [Description],
                p.[Amount] AS A1,
                {Kind("LOWER(p.[Method]) = 'cash'", "LOWER(p.[Method]) IN ('card', 'bank_transfer', 'bank transfer', 'cheque', 'online')")} AS A2,
                {Zero("A3", "A4", "A5", "A6", "A7")}
                """,
            FromWhere: """
                FROM [library].[fine_payments] p
                JOIN [library].[fines] f ON f.[Id] = p.[FineId]
                WHERE p.[TenantId] = {0} AND p.[JournalEntryId] IS NULL AND p.[Amount] > 0
                  AND LEFT(p.[PaidOn], 10) >= {1}
                """,
            OrderBy: "p.[CreatedAt]",
            Amounts: r => new() { [r.A2 == 1 ? "cash" : "bank"] = r.A1, ["revenue"] = r.A1 },
            Check: r => r.A2 == 0 ? "The payment was recorded as 'other', so it is not known whether cash or the bank received it." : null),

        // Only runs with no journal entry: the approval screen posts one from the browser when it
        // can, and a run it already posted must not be posted again from here.
        new("hr.payroll",
            IdExpr: "r.[Id]",
            Select: $"""
                r.[Id], r.[RunNumber] AS [Number],
                CONVERT(varchar(10), COALESCE(r.[FinanceApprovedAt], r.[CreatedAt]), 23) AS [Date],
                CAST(N'Payroll ' + r.[Period] AS nvarchar(200)) AS [Description],
                r.[TotalBasicSalary] AS A1, r.[TotalAllowances] AS A2, r.[TotalDeductions] AS A3, r.[TotalNetSalary] AS A4,
                {Zero("A5", "A6", "A7")}
                """,
            FromWhere: """
                FROM [hr].[payroll_runs] r
                WHERE r.[TenantId] = {0} AND r.[IsDeleted] = 0
                  AND r.[Status] IN ('finance_approved', 'paid') AND r.[JournalEntryId] IS NULL
                  AND r.[TotalNetSalary] > 0
                  AND CONVERT(varchar(10), COALESCE(r.[FinanceApprovedAt], r.[CreatedAt]), 23) >= {1}
                """,
            OrderBy: "r.[CreatedAt]",
            Amounts: r =>
            {
                var gross = r.A1 + r.A2;
                return new() { ["expense"] = gross, ["payable"] = r.A4, ["deductions"] = gross - r.A4 };
            },
            // Slip figures are rounded one employee at a time, so a run's totals can be out by a
            // little. More than that means the run's own totals do not describe the same payroll.
            Check: r =>
                r.A1 < 0 || r.A2 < 0 || r.A3 < 0      ? "The run has a negative total." :
                r.A1 + r.A2 < r.A4                     ? $"Net pay ({r.A4:0.00}) is more than gross pay ({r.A1 + r.A2:0.00})." :
                Math.Abs(r.A1 + r.A2 - r.A3 - r.A4) > 1m
                    ? $"The run's totals do not agree: basic {r.A1:0.00} + allowances {r.A2:0.00} − deductions {r.A3:0.00} is not the net pay {r.A4:0.00}."
                    : null),

        // Approved returns only: a rejected one never happened, and "completed" is never reached by
        // the Sales module today. Item prices are before tax, and a return carries no tax and no
        // invoice, so this reverses revenue only.
        new("sales.return",
            IdExpr: "r.[Id]",
            Select: $"""
                r.[Id], r.[ReturnNumber] AS [Number],
                CAST(LEFT(COALESCE(NULLIF(r.[ProcessedDate], ''), r.[RequestDate]), 10) AS varchar(10)) AS [Date],
                CAST(LEFT(r.[CustomerName] + N' — ' + r.[OrderNumber], 200) AS nvarchar(200)) AS [Description],
                ISNULL((SELECT SUM(i.[Quantity] * i.[UnitPrice]) FROM [sales].[sales_return_items] i WHERE i.[ReturnId] = r.[Id]), 0) AS A1,
                {Zero("A2", "A3", "A4", "A5", "A6", "A7")}
                """,
            FromWhere: """
                FROM [sales].[sales_returns] r
                WHERE r.[TenantId] = {0} AND r.[IsDeleted] = 0 AND r.[Status] = 'approved'
                  AND LEFT(COALESCE(NULLIF(r.[ProcessedDate], ''), r.[RequestDate]), 10) >= {1}
                """,
            OrderBy: "r.[CreatedAt]",
            Amounts: r => new() { ["revenue"] = r.A1, ["receivable"] = r.A1 },
            Check: r => r.A1 <= 0 ? "The return has no items with a value." : null,
            CancelledFrom: "FROM [sales].[sales_returns] r",
            CancelledWhere: "(r.[IsDeleted] = 1 OR r.[Status] = 'rejected')"),
    ];

    public static PostingSource? Find(string key) =>
        All.FirstOrDefault(s => string.Equals(s.Key, key, StringComparison.OrdinalIgnoreCase));
}
