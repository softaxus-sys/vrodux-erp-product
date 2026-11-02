namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>Which side is allowed to write a table in a branch-server deployment.</summary>
public enum SyncOwner
{
    /// <summary>The branch server writes it; it flows UP to the cloud.</summary>
    Branch,

    /// <summary>Head office writes it; it flows DOWN to the branch. Read-only at the branch.</summary>
    Cloud,

    /// <summary>
    /// Written on one side only but never copied: a local ledger or a cloud-only secret. Listed
    /// explicitly so "forgot to classify it" and "decided not to sync it" are different things.
    /// </summary>
    NotSynced,
}

/// <summary>One table's place in the branch-server sync, and why.</summary>
public sealed record BranchSyncEntry(string Table, SyncOwner Owner, string Reason);

/// <summary>
/// The ownership map for a branch-server deployment: for every restaurant and POS table, exactly one
/// writer. This is the rule that removes merge conflicts - a row is never edited in both places.
///
/// <para>
/// <b>An allow-list that must be exhaustive.</b> A table that appears in none of the lists is a
/// failure (see <c>BranchSyncCatalogTests</c>), not an implicit "ignore". A table added by a later
/// migration therefore stops the build until someone decides who owns it, instead of silently
/// flowing the wrong way.
/// </para>
///
/// <para>See <c>docs/branch-server-design.md</c> §4.</para>
/// </summary>
public static class BranchSyncCatalog
{
    /// <summary>Schemas this catalogue classifies. Other modules stay cloud-only for now.</summary>
    public static readonly string[] Schemas = ["restaurant", "pos", "identity", "inventory"];

    public static readonly IReadOnlyList<BranchSyncEntry> All =
    [
        // ── Branch-owned: operational records created at the till ──────────────────────────────
        new("restaurant.Orders",                 SyncOwner.Branch, "The bill itself."),
        new("restaurant.OrderItems",             SyncOwner.Branch, "Lines on a bill."),
        new("restaurant.OrderItemModifiers",     SyncOwner.Branch, "Modifier choices on a line."),
        new("restaurant.OrderPayments",          SyncOwner.Branch, "Money taken at the branch."),
        new("restaurant.OrderDiscounts",         SyncOwner.Branch, "Discounts applied at the till."),
        new("restaurant.OrderRefunds",           SyncOwner.Branch, "Refunds paid at the branch."),
        new("restaurant.OrderVoidLogs",          SyncOwner.Branch, "Audit trail of voids."),
        new("restaurant.TableTransferLogs",      SyncOwner.Branch, "Table moves during service."),
        new("restaurant.DeliveryOrders",         SyncOwner.Branch, "Delivery legs dispatched from the branch."),
        new("restaurant.BranchInstructionResults", SyncOwner.Branch, "What the branch did about a head-office instruction."),
        new("restaurant.RelayedOrderResults",  SyncOwner.Branch, "What the branch did with a QR / Foodpanda order relayed from the cloud."),
        new("restaurant.PlatformActionRequests", SyncOwner.Branch, "Foodpanda accept / reject / hand-over asked at the till; the cloud calls Foodpanda."),
        new("restaurant.DigitalReceiptLogs",     SyncOwner.Branch, "Receipts sent from the branch."),
        new("restaurant.TableOrderingSessions",  SyncOwner.Branch, "QR sessions on the branch's tables."),
        new("restaurant.Reservations",           SyncOwner.Branch, "Bookings taken and seated at the branch."),
        new("restaurant.WaitlistEntries",        SyncOwner.Branch, "Walk-in queue."),
        new("restaurant.Drivers",                SyncOwner.Branch, "Riders on the branch's roster."),
        new("restaurant.DeviceRegistrations",    SyncOwner.Branch, "Hardware registered at the branch."),
        new("pos.pos_sessions",                  SyncOwner.Branch, "Shifts and the cash drawer."),
        new("pos.cash_movements",                SyncOwner.Branch, "Cash in / out of the drawer."),
        new("pos.held_transactions",             SyncOwner.Branch, "Parked retail carts."),
        new("pos.pos_transactions",              SyncOwner.Branch, "Retail sales."),
        new("pos.pos_line_items",                SyncOwner.Branch, "Lines on a retail sale."),
        new("pos.pos_payments",                  SyncOwner.Branch, "Payments on a retail sale."),
        new("pos.stock_movements",               SyncOwner.Branch, "Stock moved by this branch's sales."),
        new("pos.branch_stock",                  SyncOwner.Branch, "How much of each product this branch holds - changed by the branch's own sales, returns and adjustments."),

        // ── Cloud-owned: configuration set at head office ──────────────────────────────────────
        new("restaurant.BranchInstructions",     SyncOwner.Cloud, "Requests from head office to a branch (void / refund a bill). The branch applies them."),
        new("restaurant.RelayedOrders",          SyncOwner.Cloud, "QR / kiosk / Foodpanda orders received by the cloud for a branch on its own server. The branch creates the bill."),
        new("restaurant.PlatformActionResults",  SyncOwner.Cloud, "The cloud's answer to a Foodpanda action asked at the branch."),
        new("restaurant.MenuCategories",         SyncOwner.Cloud, "Menu."),
        new("restaurant.MenuItems",              SyncOwner.Cloud, "Menu."),
        new("restaurant.MenuItemImages",         SyncOwner.Cloud, "Menu."),
        new("restaurant.MenuItemModifierGroups", SyncOwner.Cloud, "Menu."),
        new("restaurant.ModifierGroups",         SyncOwner.Cloud, "Menu."),
        new("restaurant.Modifiers",              SyncOwner.Cloud, "Menu."),
        new("restaurant.MenuItemBranchSettings", SyncOwner.Cloud, "Per-branch price / availability, set centrally."),
        new("restaurant.Combos",                 SyncOwner.Cloud, "Menu."),
        new("restaurant.ComboItems",             SyncOwner.Cloud, "Menu."),
        new("restaurant.HappyHourRules",         SyncOwner.Cloud, "Pricing rules."),
        new("restaurant.TaxProfiles",            SyncOwner.Cloud, "Tax and the FBR account."),
        new("restaurant.Floors",                 SyncOwner.Cloud, "Floor plan."),
        new("restaurant.DiningAreas",            SyncOwner.Cloud, "Floor plan."),
        new("restaurant.Tables",                 SyncOwner.Cloud, "Layout is head office's. Live table status is branch state - see the mixed-ownership note below."),
        new("restaurant.DeliveryZones",          SyncOwner.Cloud, "Delivery coverage."),
        new("restaurant.KitchenStations",        SyncOwner.Cloud, "Kitchen routing."),
        new("restaurant.PrinterProfiles",        SyncOwner.Cloud, "Printer routing."),
        new("restaurant.ReservationRules",       SyncOwner.Cloud, "Booking rules."),
        new("restaurant.UserBranches",           SyncOwner.Cloud, "Who may work at which branch."),
        new("pos.customers",                     SyncOwner.Cloud, "Shared customer book; a branch proposes, head office confirms."),
        new("pos.customer_groups",               SyncOwner.Cloud, "Shared."),
        new("pos.currencies",                    SyncOwner.Cloud, "Reference data."),
        new("pos.payment_method_configs",        SyncOwner.Cloud, "Payment methods."),
        new("pos.payment_terms",                 SyncOwner.Cloud, "Reference data."),
        new("pos.tax_rates",                     SyncOwner.Cloud, "Reference data."),
        new("pos.vouchers",                      SyncOwner.Cloud, "Shared entitlements."),
        new("pos.pos_settings",                  SyncOwner.Cloud, "Per-workspace POS settings."),
        new("pos.products",                      SyncOwner.Cloud, "Catalogue."),
        new("pos.product_categories",            SyncOwner.Cloud, "Catalogue."),

        // ── Identity: who may sign in at the branch, and what they may do ─────────────────────
        new("identity.tenants",                  SyncOwner.Cloud, "The workspace itself (modules, plan, currency). Connection strings and licence key are redacted."),
        new("identity.users",                    SyncOwner.Cloud, "Staff accounts and password hashes, so sign-in works with no internet. 2FA secrets and reset tokens are redacted."),
        new("identity.roles",                    SyncOwner.Cloud, "Roles."),
        new("identity.permissions",              SyncOwner.Cloud, "The permission catalogue (global, identical on both sides)."),
        new("identity.user_roles",               SyncOwner.Cloud, "Role assignments."),
        new("identity.role_permissions",         SyncOwner.Cloud, "What each role may do."),
        new("identity.user_permissions",         SyncOwner.Cloud, "Per-user grants and denies."),
        new("identity.branches",                 SyncOwner.Cloud, "Branches."),
        new("identity.teams",                    SyncOwner.Cloud, "Teams."),
        new("identity.team_members",             SyncOwner.Cloud, "Team membership."),
        new("identity.app_settings",             SyncOwner.Cloud, "Workspace settings, including the security policy."),

        // ── Not synced ─────────────────────────────────────────────────────────────────────────
        new("identity.refresh_tokens",           SyncOwner.NotSynced, "A session issued at one server means nothing at the other."),
        new("identity.user_device_tokens",       SyncOwner.NotSynced, "Push registrations for devices on one site."),
        new("identity.audit_logs",               SyncOwner.NotSynced, "Per-server log. Uploading branch audit entries is a later step."),
        new("identity.subscriptions",            SyncOwner.NotSynced, "Cloud-only: money."),
        new("identity.subscription_invoices",    SyncOwner.NotSynced, "Cloud-only: money."),
        new("identity.billing_settings",         SyncOwner.NotSynced, "Cloud-only: payment configuration."),
        new("identity.billing_webhook_events",   SyncOwner.NotSynced, "Cloud-only: provider ledger."),
        new("identity.tenant_sync_settings",     SyncOwner.NotSynced, "The on-premises mirror's own configuration."),
        new("restaurant.OfflineOps",             SyncOwner.NotSynced, "Per-till upload ledger; meaningless once a branch server exists."),
        new("restaurant.OrderCounters",          SyncOwner.NotSynced, "Local order-number counter; each server counts its own branch codes."),
        new("restaurant.PlatformConnections",    SyncOwner.NotSynced, "Foodpanda credentials and plugin secret stay in the cloud, which receives the webhooks."),
        new("restaurant.NotificationProviderConfigs", SyncOwner.NotSynced, "SMS / WhatsApp provider secrets stay in the cloud."),
        new("pos.customer_wallet_transactions",  SyncOwner.NotSynced, "Shared balance, online-only by design; an offline branch refuses wallet payments."),
        new("pos.credit_reminder_logs",          SyncOwner.NotSynced, "Reminder emails are sent from the cloud."),
        new("pos.credit_reminder_settings",      SyncOwner.NotSynced, "Reminder emails are sent from the cloud."),
        new("pos.payment_gateway_configs",       SyncOwner.NotSynced, "Gateway secrets stay in the cloud; online payments are cloud-only."),
        new("pos.offline_sync_batches",          SyncOwner.NotSynced, "Per-till replay ledger."),
        new("pos.pos_till_status",               SyncOwner.NotSynced, "Per-till offline status."),
        new("pos.purchase_orders",               SyncOwner.NotSynced, "Back-office; stays in the cloud."),
        new("pos.purchase_order_items",          SyncOwner.NotSynced, "Back-office; stays in the cloud."),
        new("pos.sales_orders",                  SyncOwner.NotSynced, "Back-office; stays in the cloud."),
        new("pos.sales_order_items",             SyncOwner.NotSynced, "Back-office; stays in the cloud."),
        // ── Inventory: the catalogue is head office's; a branch's own warehouse stock is the branch's ──
        new("inventory.products",                SyncOwner.Cloud,     "Catalogue. The product's total quantity is recomputed on the cloud from the branch warehouses' changes."),
        new("inventory.product_categories",      SyncOwner.Cloud,     "Catalogue."),
        new("inventory.brands",                  SyncOwner.Cloud,     "Catalogue."),
        new("inventory.units_of_measure",        SyncOwner.Cloud,     "Catalogue."),
        new("inventory.warehouses",              SyncOwner.Cloud,     "Head office creates each branch's warehouse; rows with a BranchId reach only that branch."),
        new("inventory.product_templates",       SyncOwner.Cloud,     "Online listing a variant product points at (foreign key)."),
        new("inventory.product_stock",           SyncOwner.Branch,    "Stock held in the branch's own warehouse - changed by its sales. Head-office warehouse rows never go up."),
        new("inventory.stock_movements",         SyncOwner.Branch,    "Movements in the branch's own warehouse. Head-office warehouse rows never go up."),
        new("inventory.product_batches",         SyncOwner.NotSynced, "Batch and expiry tracking stays at head office."),
        new("inventory.stock_transfers",         SyncOwner.NotSynced, "Transfers are head-office documents; not carried to branch servers yet."),
        new("inventory.stock_transfer_items",    SyncOwner.NotSynced, "Lines of a transfer."),
        new("inventory.product_images",          SyncOwner.NotSynced, "Online-listing photos are large and only the online store uses them."),
        new("inventory.catalogue_moves",         SyncOwner.NotSynced, "Operator audit record of a catalogue move."),
        new("pos.sales_quotations",              SyncOwner.NotSynced, "Back-office; stays in the cloud."),
        new("pos.sales_quotation_items",         SyncOwner.NotSynced, "Back-office; stays in the cloud."),
        new("pos.vendors",                       SyncOwner.NotSynced, "Back-office; stays in the cloud."),
    ];

    /// <summary>
    /// Tables whose rows carry BOTH head-office and branch fields. They are classified by their
    /// dominant owner above, and need column-level rules before the first branch goes live.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> MixedOwnership =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["restaurant.Tables"] =
                "Number, area, seats and floor position are head office's; Status and the current order are " +
                "the branch's, written on every seating. Needs column-level ownership: down-sync updates the layout " +
                "columns only, up-sync sends the status columns only.",
            ["pos.customers"] =
                "Created at a branch, confirmed at head office, balances are cloud-only. Needs the pending-customer flow.",
        };

    /// <summary>
    /// Columns that never leave the cloud, per table. Removed from every row a branch pulls. Each one is
    /// either a secret (reset tokens, 2FA secrets - encrypted under a key derived from the cloud's own
    /// signing secret, so a branch could not read them anyway) or cloud-only configuration.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string[]> Redactions =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["identity.users"] =
            [
                "PasswordResetTokenHash", "PasswordResetTokenExpiry",
                "EmailVerificationTokenHash", "EmailVerificationTokenExpiry",
                "TwoFactorSecret", "TwoFactorBackupCodes",
            ],
            ["identity.tenants"] = ["ConnectionStrings", "LicenseKey", "LicenseExpiresAt", "LastHeartbeatAt", "UtmSource", "SignupIntent", "SignupBillingPeriod"],
        };

    /// <summary>How a table with no TenantId column of its own is limited to the branch's workspace.</summary>
    public enum ScopeKind { Global, ById, ByParent }

    /// <param name="Kind">Global = identical for everyone; ById = the row IS the workspace; ByParent = follows a parent row's workspace.</param>
    /// <param name="ParentTable">For ByParent: the table that carries TenantId, e.g. identity.users.</param>
    /// <param name="ForeignKey">For ByParent: the column here that points at the parent's Id.</param>
    public sealed record ScopeRule(ScopeKind Kind, string? ParentTable = null, string? ForeignKey = null);

    /// <summary>
    /// Tables the generic tenant filter cannot handle (no TenantId column). Without these, a branch would be
    /// sent every other workspace's role assignments and team memberships - ids only, but still a leak.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, ScopeRule> Scopes =
        new Dictionary<string, ScopeRule>(StringComparer.OrdinalIgnoreCase)
        {
            ["identity.tenants"]          = new(ScopeKind.ById),
            ["identity.permissions"]      = new(ScopeKind.Global),
            ["identity.user_roles"]       = new(ScopeKind.ByParent, "identity.users", "UserId"),
            ["identity.user_permissions"] = new(ScopeKind.ByParent, "identity.users", "UserId"),
            ["identity.role_permissions"] = new(ScopeKind.ByParent, "identity.roles", "RoleId"),
            ["identity.team_members"]     = new(ScopeKind.ByParent, "identity.teams", "TeamId"),
        };

/// <summary>
    /// Branch-owned tables whose rows are keyed by a warehouse rather than carrying a BranchId. A row belongs to
    /// the branch only if its warehouse does (<c>inventory.warehouses.BranchId</c>). Head-office warehouse rows
    /// are never pushed up by a branch, and the cloud rejects a push that names another branch's warehouse.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> WarehouseOwned =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["inventory.product_stock"]   = "WarehouseId",
            ["inventory.stock_movements"] = "WarehouseId",
        };

    /// <summary>
    /// Branch-owned tables the cloud ALSO sends down, once, so a branch starts from the opening quantity head
    /// office recorded (a catalogue move, a stock count). Applied insert-only: a row the branch already has
    /// is never overwritten, because from then on the branch is the one changing it.
    /// </summary>
    public static readonly IReadOnlySet<string> OpeningBalances =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "inventory.product_stock" };

    public static bool IsOpeningBalance(string schemaDotTable) => OpeningBalances.Contains(schemaDotTable);

    /// <summary>Columns that identify a row to people regardless of its id (a unique index backs each).</summary>
    public static IReadOnlyList<string>? NaturalKeyOf(string schemaDotTable) =>
        schemaDotTable.Equals("inventory.product_stock", StringComparison.OrdinalIgnoreCase) ? ["ProductId", "WarehouseId"] : null;

    public static IEnumerable<BranchSyncEntry> OwnedBy(SyncOwner owner) =>
        All.Where(e => e.Owner == owner);

    public static SyncOwner? OwnerOf(string schemaDotTable) =>
        All.FirstOrDefault(e => string.Equals(e.Table, schemaDotTable, StringComparison.OrdinalIgnoreCase))?.Owner;
}
