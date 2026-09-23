namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>One table in the mirror's scope.</summary>
/// <param name="Schema">SQL schema, e.g. <c>pos</c>.</param>
/// <param name="Table">Table name, e.g. <c>pos_transactions</c>.</param>
/// <param name="KeyColumns">
/// The primary key columns, discovered from the database rather than assumed. Most tables have a
/// single GUID <c>Id</c>, but the identity join tables do not - <c>user_roles</c> is
/// <c>(UserId, RoleId)</c>, and <c>role_permissions</c>, <c>user_permissions</c> and
/// <c>team_members</c> are likewise composite. Assuming <c>Id</c> would break exactly the four
/// tables that decide what a mirrored user can see.
/// </param>
/// <param name="HasTenantId">
/// Whether the table carries the shadow <c>TenantId</c> column. Reads are filtered by it, because
/// an installation pushes ITS workspace and nobody else's - a box that has ever held a second
/// workspace would otherwise try to send that one's rows too. A few tables in scope are global
/// reference data (<c>identity.permissions</c>) and have no such column; those are sent whole.
/// </param>
public sealed record SyncTable(
    string Schema, string Table, IReadOnlyList<string> KeyColumns, bool HasTenantId = false)
{
    /// <summary>Bracketed, injection-safe two-part name.</summary>
    public string Qualified => $"[{Schema}].[{Table}]";

    /// <summary>Stable identifier used as the watermark key and on the wire.</summary>
    public string Name => $"{Schema}.{Table}";

    public override string ToString() => Name;
}

/// <summary>
/// The tables an on-premises installation pushes to its cloud mirror.
///
/// <para>
/// <b>An allow-list, never a deny-list.</b> A table added by a future module therefore defaults to
/// NOT synced and somebody has to think about it, rather than silently flowing to the cloud and
/// possibly overwriting something that belongs to the cloud alone. <see cref="SyncTableCatalog"/>
/// is checked against the live database on startup, so a table missing from this list is reported
/// rather than quietly skipped - the one failure mode an allow-list otherwise has.
/// </para>
///
/// <para>
/// Ordering is NOT hand-maintained here. Rows must land parents-first, and that order is derived
/// from the database's own foreign keys at run time (<see cref="SyncTableOrder"/>): a hand-written
/// order drifts the moment a migration adds a relationship, and the resulting failure looks like a
/// transport bug.
/// </para>
///
/// <para>See <c>docs/on-premises-cloud-mirror.md</c> §4.</para>
/// </summary>
public static class SyncTableCatalog
{
    /// <summary>Schemas fully in scope - every business table the client's modules write.</summary>
    public static readonly string[] BusinessSchemas = ["pos", "inventory", "finance"];

    /// <summary>
    /// Tables in <see cref="BusinessSchemas"/> that are deliberately NOT pushed. Each is local
    /// operational state about this installation's own tills, not business data, and means nothing
    /// in the mirror.
    /// </summary>
    public static readonly HashSet<string> BusinessExclusions = new(StringComparer.OrdinalIgnoreCase)
    {
        // Module 58 offline mode: which till holds how many unsynced browser-side records, and the
        // ledger of till-to-server replays. Both describe hardware on this site.
        "pos.pos_till_status",
        "pos.offline_sync_batches",
    };

    /// <summary>
    /// The identity tables that make the mirror readable: who the users are and what they may see.
    /// Everything else in <c>identity</c> is cloud-owned or installation-local - see
    /// <see cref="IdentityExclusionReasons"/>.
    /// </summary>
    public static readonly string[] IdentityTables =
    [
        "users", "roles", "permissions", "user_roles", "role_permissions", "user_permissions",
        "branches", "teams", "team_members", "app_settings", "audit_logs",
    ];

    /// <summary>
    /// Why each remaining <c>identity</c> table is out of scope. Kept as data rather than prose
    /// because the startup check reports unknown tables against it, and because getting one of
    /// these wrong breaks billing rather than merely losing a row.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> IdentityExclusionReasons =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["tenants"] =
                "Cloud-owned: plan, subscription state, trial dates, IsMirror and the billing " +
                "relationship live there. A push would let the shop's local copy overwrite them nightly.",
            ["subscriptions"]          = "Cloud-owned: money, and the payment providers' source of truth.",
            ["subscription_invoices"]  = "Cloud-owned: money.",
            ["billing_settings"]       = "Cloud-owned: platform payment configuration.",
            ["billing_webhook_events"] = "Cloud-owned: the provider idempotency ledger.",
            ["refresh_tokens"]         = "Per installation. A session issued in the shop is meaningless in the mirror.",
            ["user_device_tokens"]     = "Per installation: push registrations for devices on this site.",
            ["tenant_sync_settings"]   = "This installation's own push configuration. The mirror has none.",
            ["__EFMigrationsHistory"]  = "Schema state, applied independently on each side.",
        };

    /// <summary>
    /// The catalogue for a live database: every business table except the exclusions, plus the
    /// identity subset. Built from what actually exists rather than from a hardcoded list, so a
    /// table renamed by a migration cannot leave a phantom entry behind.
    /// </summary>
    public static IReadOnlyList<SyncTable> Build(
        IEnumerable<(string Schema, string Table, IReadOnlyList<string> KeyColumns, bool HasTenantId)> existing)
    {
        var result = new List<SyncTable>();

        foreach (var (schema, table, keys, hasTenant) in existing)
        {
            // No primary key means no way to identify the row on the other side. Nothing in scope
            // is keyless today; skipping loudly beats pushing rows that cannot be upserted.
            if (keys.Count == 0) continue;

            var name = $"{schema}.{table}";

            if (BusinessSchemas.Contains(schema, StringComparer.OrdinalIgnoreCase))
            {
                if (!BusinessExclusions.Contains(name)) result.Add(new SyncTable(schema, table, keys, hasTenant));
            }
            else if (schema.Equals("identity", StringComparison.OrdinalIgnoreCase) &&
                     IdentityTables.Contains(table, StringComparer.OrdinalIgnoreCase))
            {
                result.Add(new SyncTable(schema, table, keys, hasTenant));
            }
        }

        return result;
    }
}
