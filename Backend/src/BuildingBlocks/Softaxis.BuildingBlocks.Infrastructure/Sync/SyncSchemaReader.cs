using Microsoft.Data.SqlClient;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>
/// Reads the database's own metadata: which tables exist, their primary keys, and which table
/// depends on which. Everything the sync layer knows about shape comes from here rather than from a
/// hardcoded list, so a migration cannot leave the catalogue describing a database that no longer
/// looks like that.
/// </summary>
public sealed class SyncSchemaReader(string connectionString)
{
    /// <summary>Every table in the given schemas, with its primary key columns in key order.</summary>
    public async Task<List<(string Schema, string Table, IReadOnlyList<string> KeyColumns, bool HasTenantId)>>
        ReadTablesAsync(IEnumerable<string> schemas, CancellationToken ct = default)
    {
        // Schema names come from our own constants, never from user input, but they are still passed
        // as parameters rather than concatenated - the habit is what keeps it true later.
        var names = schemas.ToArray();
        var inClause = string.Join(",", names.Select((_, i) => $"@s{i}"));

        const string sqlTemplate = """
            SELECT  s.name  AS SchemaName,
                    t.name  AS TableName,
                    c.name  AS ColumnName,
                    ic.key_ordinal AS KeyOrdinal,
                    CAST(CASE WHEN EXISTS (
                        SELECT 1 FROM sys.columns tc
                        WHERE tc.object_id = t.object_id AND tc.name = 'TenantId') THEN 1 ELSE 0 END AS BIT) AS HasTenantId
            FROM        sys.tables   t
            JOIN        sys.schemas  s  ON s.schema_id = t.schema_id
            LEFT JOIN   sys.indexes  i  ON i.object_id = t.object_id AND i.is_primary_key = 1
            LEFT JOIN   sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            LEFT JOIN   sys.columns  c  ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE   s.name IN ({0})
            ORDER BY s.name, t.name, ic.key_ordinal
            """;

        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = string.Format(sqlTemplate, inClause);
        for (var i = 0; i < names.Length; i++)
            cmd.Parameters.Add(new SqlParameter($"@s{i}", names[i]));

        var byTable = new Dictionary<(string, string), List<string>>();
        var tenantFlag = new Dictionary<(string, string), bool>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var key = (reader.GetString(0), reader.GetString(1));
            if (!byTable.TryGetValue(key, out var cols))
                byTable[key] = cols = [];

            tenantFlag[key] = reader.GetBoolean(4);
            if (!reader.IsDBNull(2)) cols.Add(reader.GetString(2));
        }

        return byTable
            .Select(kv => (kv.Key.Item1, kv.Key.Item2, (IReadOnlyList<string>)kv.Value,
                           tenantFlag.GetValueOrDefault(kv.Key)))
            .ToList();
    }

    /// <summary>
    /// Foreign-key edges between tables, as (child → parent). Self-references are dropped: a table
    /// pointing at itself says nothing about the order of two different tables, and would make the
    /// dependency graph look cyclic when it is not.
    /// </summary>
    public async Task<List<(string Child, string Parent)>> ReadDependenciesAsync(
        IEnumerable<string> schemas, CancellationToken ct = default)
    {
        var names = schemas.ToArray();
        var inClause = string.Join(",", names.Select((_, i) => $"@s{i}"));

        const string sqlTemplate = """
            SELECT  cs.name + '.' + ct.name AS Child,
                    ps.name + '.' + pt.name AS Parent
            FROM    sys.foreign_keys fk
            JOIN    sys.tables  ct ON ct.object_id = fk.parent_object_id
            JOIN    sys.schemas cs ON cs.schema_id = ct.schema_id
            JOIN    sys.tables  pt ON pt.object_id = fk.referenced_object_id
            JOIN    sys.schemas ps ON ps.schema_id = pt.schema_id
            WHERE   cs.name IN ({0}) AND ps.name IN ({0})
              AND   fk.parent_object_id <> fk.referenced_object_id
            """;

        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = string.Format(sqlTemplate, inClause);
        for (var i = 0; i < names.Length; i++)
            cmd.Parameters.Add(new SqlParameter($"@s{i}", names[i]));

        var edges = new List<(string, string)>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            edges.Add((reader.GetString(0), reader.GetString(1)));

        return edges;
    }
}

/// <summary>
/// Orders the catalogue so a row's parents are always pushed before the row itself.
/// </summary>
public static class SyncTableOrder
{
    /// <summary>
    /// Topological sort over the foreign-key graph, parents first.
    ///
    /// <para>
    /// A cycle is possible in principle (two tables referencing each other) and is NOT treated as an
    /// error: the remaining tables are appended in their existing order, and the deferred-retry
    /// queue on the receiving side sorts out any row that lands before its parent. Throwing here
    /// would mean one awkward relationship stops the entire nightly push.
    /// </para>
    /// </summary>
    public static IReadOnlyList<SyncTable> Sort(
        IReadOnlyList<SyncTable> tables, IEnumerable<(string Child, string Parent)> dependencies)
    {
        var inScope  = tables.ToDictionary(t => t.Name, StringComparer.OrdinalIgnoreCase);
        var parents  = tables.ToDictionary(t => t.Name, _ => new HashSet<string>(StringComparer.OrdinalIgnoreCase),
                                           StringComparer.OrdinalIgnoreCase);

        foreach (var (child, parent) in dependencies)
        {
            // Edges to tables outside the catalogue are ignored: an excluded parent is excluded on
            // purpose, and waiting for it would strand its children forever.
            if (inScope.ContainsKey(child) && inScope.ContainsKey(parent))
                parents[child].Add(parent);
        }

        var ordered = new List<SyncTable>(tables.Count);
        var placed  = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Repeatedly take every table whose parents are all placed. Deterministic order within a
        // pass keeps runs comparable in logs.
        bool progress;
        do
        {
            progress = false;
            foreach (var t in tables.OrderBy(t => t.Name, StringComparer.OrdinalIgnoreCase))
            {
                if (placed.Contains(t.Name)) continue;
                if (!parents[t.Name].All(placed.Contains)) continue;

                ordered.Add(t);
                placed.Add(t.Name);
                progress = true;
            }
        }
        while (progress);

        // Anything left is in a cycle - append rather than fail.
        foreach (var t in tables)
            if (!placed.Contains(t.Name)) ordered.Add(t);

        return ordered;
    }
}
