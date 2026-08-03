using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Softaxis.Inventory.Infrastructure.Persistence;
using Softaxis.Recipe.Infrastructure.Persistence;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Shares one real ADO.NET transaction across the Restaurant/Recipe/Inventory DbContexts for the
/// "serve order → deduct recipe stock" flow, so marking an item served and deducting its recipe's
/// ingredient stock either both commit or neither does.
///
/// All three point at the same physical database (different schemas), but each is a separately
/// DI-registered DbContext with its OWN SqlConnection — EF's Database.UseTransaction throws
/// "the specified transaction is not associated with the current connection" unless the target
/// context is already on the exact same DbConnection OBJECT as the transaction, not merely the same
/// connection string. So the connection itself must be shared first (SetDbConnection), then the
/// transaction (UseTransaction). contextOwnsConnection is false for the borrower contexts so they
/// don't dispose a connection that RestaurantDbContext (the owner here) still needs.
/// </summary>
internal sealed class SharedTransactionScope : IAsyncDisposable
{
    private readonly IDbContextTransaction _tx;
    private bool _committed;

    private SharedTransactionScope(IDbContextTransaction tx) => _tx = tx;

    public static async Task<SharedTransactionScope> BeginAsync(
        RestaurantDbContext restaurantDb, RecipeDbContext recipeDb, InventoryDbContext inventoryDb, CancellationToken ct)
    {
        var connection = restaurantDb.Database.GetDbConnection();
        recipeDb.Database.SetDbConnection(connection, contextOwnsConnection: false);
        inventoryDb.Database.SetDbConnection(connection, contextOwnsConnection: false);

        var tx = await restaurantDb.Database.BeginTransactionAsync(ct);
        recipeDb.Database.UseTransaction(tx.GetDbTransaction());
        inventoryDb.Database.UseTransaction(tx.GetDbTransaction());

        return new SharedTransactionScope(tx);
    }

    public Task CommitAsync(CancellationToken ct)
    {
        _committed = true;
        return _tx.CommitAsync(ct);
    }

    public async ValueTask DisposeAsync()
    {
        if (!_committed)
        {
            try { await _tx.RollbackAsync(); } catch { /* connection may already be gone if commit partially completed */ }
        }
        await _tx.DisposeAsync();
    }
}
