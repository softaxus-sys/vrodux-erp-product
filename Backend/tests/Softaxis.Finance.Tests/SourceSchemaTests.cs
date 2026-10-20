using Microsoft.Data.SqlClient;
using Softaxis.Finance.Infrastructure.Integrations;

namespace Softaxis.Finance.Tests;

/// <summary>
/// Runs every source's SQL against a real database, so a renamed column in another module's table
/// fails here instead of at a customer's first collection.
///
/// <para>Needs a database with the product's schema. Set <c>FINANCE_TEST_DB</c> to a connection
/// string to run it; without one the tests pass without doing anything. Nothing is written.</para>
/// </summary>
public class SourceSchemaTests
{
    private static readonly string? ConnectionString = Environment.GetEnvironmentVariable("FINANCE_TEST_DB");

    public static IEnumerable<object[]> Keys() => PostingSources.All.Select(s => new object[] { s.Key });

    private static async Task<int> RunAsync(string sql, params object[] args)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        for (var i = 0; i < args.Length; i++)
        {
            sql = sql.Replace("{" + i + "}", "@p" + i);
            command.Parameters.AddWithValue("@p" + i, args[i]);
        }
        command.CommandText = sql;

        var rows = 0;
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) rows++;
        return rows;
    }

    [Theory]
    [MemberData(nameof(Keys))]
    public async Task Collect_query_runs_and_returns_every_column(string key)
    {
        if (ConnectionString is null) return;
        var source = PostingSources.Find(key)!;

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT TOP (1) {source.Select} {source.FromWhere} ORDER BY {source.OrderBy}"
            .Replace("{0}", "@p0").Replace("{1}", "@p1");
        command.Parameters.AddWithValue("@p0", Guid.Empty);
        command.Parameters.AddWithValue("@p1", "0001-01-01");

        await using var reader = await command.ExecuteReaderAsync();
        var columns = Enumerable.Range(0, reader.FieldCount).Select(reader.GetName).ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var expected in new[] { "Id", "Number", "Date", "Description", "A1", "A2", "A3", "A4", "A5", "A6", "A7" })
            Assert.Contains(expected, columns);
        Assert.Equal(11, reader.FieldCount);
    }

    [Theory]
    [MemberData(nameof(Keys))]
    public async Task Verify_and_reconcile_queries_run(string key)
    {
        if (ConnectionString is null) return;
        var source = PostingSources.Find(key)!;

        // The same shapes PostingEngine builds: one document by id, and every open item's document.
        await RunAsync($"SELECT {source.Select} {source.FromWhere} AND {source.IdExpr} = {{2}}",
            Guid.Empty, "0001-01-01", Guid.Empty);

        await RunAsync(
            $"SELECT {source.Select} {source.FromWhere} " +
            "AND EXISTS (SELECT 1 FROM [finance].[posting_items] q " +
            $"WHERE q.[TenantId] = {{0}} AND q.[IntegrationKey] = {{2}} AND q.[SourceId] = {source.IdExpr} " +
            "AND q.[Status] IN ('pending', 'failed'))",
            Guid.Empty, "0001-01-01", source.Key);

        await RunAsync(
            $"SELECT COUNT(*) AS [Value] {source.FromWhere} " +
            "AND NOT EXISTS (SELECT 1 FROM [finance].[posting_items] q " +
            $"WHERE q.[TenantId] = {{0}} AND q.[IntegrationKey] = {{2}} AND q.[SourceId] = {source.IdExpr})",
            Guid.Empty, "0001-01-01", source.Key);
    }

    [Theory]
    [MemberData(nameof(Keys))]
    public async Task Cancelled_after_posting_query_runs(string key)
    {
        if (ConnectionString is null) return;
        var source = PostingSources.Find(key)!;
        if (source.CancelledWhere is null) return;

        await RunAsync(
            $"SELECT {source.IdExpr} AS [Value] {source.CancelledFrom} WHERE {source.CancelledWhere} " +
            "AND EXISTS (SELECT 1 FROM [finance].[posting_items] q " +
            $"WHERE q.[TenantId] = {{0}} AND q.[IntegrationKey] = {{1}} AND q.[SourceId] = {source.IdExpr} " +
            "AND q.[Status] = 'posted' AND q.[LastError] IS NULL)",
            Guid.Empty, source.Key);
    }

    [Fact]
    public async Task Link_back_columns_exist()
    {
        if (ConnectionString is null) return;

        // PostingEngine writes these when it posts a payroll run or a library fine payment.
        await RunAsync("SELECT TOP (0) [Id], [TenantId], [JournalEntryId], [JournalEntryNumber] FROM [hr].[payroll_runs]");
        await RunAsync("SELECT TOP (0) [Id], [TenantId], [JournalEntryId], [JournalEntryNumber], [PostedAt] FROM [library].[fine_payments]");
    }
}
