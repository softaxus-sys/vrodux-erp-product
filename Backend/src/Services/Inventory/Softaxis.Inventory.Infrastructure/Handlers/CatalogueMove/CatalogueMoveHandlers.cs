using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.CatalogueMove;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.Infrastructure.Handlers.CatalogueMove;

/// <summary>
/// Moving a workspace's product catalogue from the POS schema into Inventory.
///
/// <para>Everything is raw SQL against explicit tenant ids, on purpose: the caller is a super admin with no
/// tenant context, and the move spans two schemas that no single EF model owns. The write is one
/// transaction, so a move either happens completely or not at all.</para>
///
/// <para><b>Ids are kept.</b> Sale lines, offline queues and sync references store a product id and nothing
/// else, so every moved product keeps the id it had.</para>
/// </summary>
internal static class CatalogueMoveSupport
{
    public static readonly Error NoTenant = Error.Custom("CatalogueMove.NotFound", "That workspace was not found.");

    private sealed class TenantRow
    {
        public string Name { get; set; } = "";
        public bool BranchServersEnabled { get; set; }
        public bool IsMirror { get; set; }
        public string? DeploymentType { get; set; }
    }
    private sealed class IntRow { public int Value { get; set; } }
    private sealed class DecRow { public decimal Value { get; set; } }
    private sealed class ClashRow
    {
        public Guid PosProductId { get; set; } public string PosName { get; set; } = "";
        public string Value { get; set; } = "";
        public Guid InventoryProductId { get; set; } public string InventoryName { get; set; } = "";
    }
    private sealed class BranchRow
    {
        public Guid BranchId { get; set; } public string? Name { get; set; }
        public bool HasWarehouse { get; set; } public int Products { get; set; } public decimal Units { get; set; }
    }

    private static SqlParameter T(Guid t) => new("@t", t);

    private static async Task<int> Int(InventoryDbContext db, string sql, Guid t, CancellationToken ct) =>
        (await db.Database.SqlQueryRaw<IntRow>(sql, T(t)).ToListAsync(ct)).First().Value;

    private static async Task<decimal> Dec(InventoryDbContext db, string sql, Guid t, CancellationToken ct) =>
        (await db.Database.SqlQueryRaw<DecRow>(sql, T(t)).ToListAsync(ct)).First().Value;

    private sealed class NameRow { public string? Value { get; set; } }

    /// <summary>
    /// Branch-server branches of the workspace that have not uploaded within 15 minutes or are failing. When the
    /// sync bookkeeping does not exist at all (no branch has ever synced), every branch-server branch is listed.
    /// </summary>
    private static async Task<List<string>> BranchesNotInContactAsync(InventoryDbContext db, Guid t, CancellationToken ct)
    {
        const string all = "SELECT br.Name AS Value FROM [identity].[branches] br WHERE br.TenantId = @t AND br.IsDeleted = 0 AND br.ServerMode = 'local'";
        try
        {
            var rows = await db.Database.SqlQueryRaw<NameRow>(all + """
                 AND NOT EXISTS (SELECT 1 FROM [sync].[branch_status] s
                                 WHERE s.BranchId = br.Id AND s.LastUpOkAt > DATEADD(MINUTE, -15, SYSUTCDATETIME()) AND s.ConsecutiveFailures = 0)
                """, T(t)).ToListAsync(ct);
            return rows.Select(r => r.Value ?? "Unnamed branch").ToList();
        }
        catch (SqlException)
        {
            var rows = await db.Database.SqlQueryRaw<NameRow>(all, T(t)).ToListAsync(ct);
            return rows.Select(r => r.Value ?? "Unnamed branch").ToList();
        }
    }

    public static async Task<CatalogueMoveStatusDto?> StatusAsync(InventoryDbContext db, Guid t, CancellationToken ct)
    {
        var tenant = (await db.Database.SqlQueryRaw<TenantRow>(
            "SELECT Name, BranchServersEnabled, IsMirror, DeploymentType FROM [identity].[tenants] WHERE Id = @t AND IsDeleted = 0", T(t))
            .ToListAsync(ct)).FirstOrDefault();
        if (tenant is null) return null;

        var pos = await Int(db, "SELECT COUNT(*) AS Value FROM [pos].[products] WHERE TenantId = @t AND IsDeleted = 0", t, ct);
        var inv = await Int(db, "SELECT COUNT(*) AS Value FROM [inventory].[products] WHERE TenantId = @t AND IsDeleted = 0", t, ct);

        var last = await db.CatalogueMoves.IgnoreQueryFilters().AsNoTracking()
            .Where(m => EF.Property<Guid?>(m, "TenantId") == t)
            .OrderByDescending(m => m.MovedAt)
            .Select(m => new CatalogueMoveRecordDto(m.MovedAt, m.MovedBy, m.ProductsMoved, m.AlreadyThere,
                m.CategoriesCreated, m.WarehousesCreated, m.StockBuckets))
            .FirstOrDefaultAsync(ct);

        var state = pos > 0 ? "on_pos" : inv > 0 ? "on_inventory" : "empty";
        return new CatalogueMoveStatusDto(t, tenant.Name, state, pos, inv, last);
    }

    public static async Task<CatalogueMovePreviewDto?> PreviewAsync(InventoryDbContext db, Guid t, CancellationToken ct)
    {
        var tenant = (await db.Database.SqlQueryRaw<TenantRow>(
            "SELECT Name, BranchServersEnabled, IsMirror, DeploymentType FROM [identity].[tenants] WHERE Id = @t AND IsDeleted = 0", T(t))
            .ToListAsync(ct)).FirstOrDefault();
        if (tenant is null) return null;

        var posProducts = await Int(db, "SELECT COUNT(*) AS Value FROM [pos].[products] WHERE TenantId = @t AND IsDeleted = 0", t, ct);
        var invProducts = await Int(db, "SELECT COUNT(*) AS Value FROM [inventory].[products] WHERE TenantId = @t AND IsDeleted = 0", t, ct);
        var already = await Int(db, """
            SELECT COUNT(*) AS Value FROM [pos].[products] p
            WHERE p.TenantId = @t AND p.IsDeleted = 0 AND EXISTS (SELECT 1 FROM [inventory].[products] i WHERE i.Id = p.Id AND i.IsDeleted = 0)
            """, t, ct);
        // The same id sitting soft-deleted in Inventory cannot be inserted again, and must not be silently revived.
        var deletedTwins = await Int(db, """
            SELECT COUNT(*) AS Value FROM [pos].[products] p
            WHERE p.TenantId = @t AND p.IsDeleted = 0 AND EXISTS (SELECT 1 FROM [inventory].[products] i WHERE i.Id = p.Id AND i.IsDeleted = 1)
            """, t, ct);
        var categoriesUsed = await Int(db, "SELECT COUNT(DISTINCT CategoryId) AS Value FROM [pos].[products] WHERE TenantId = @t AND IsDeleted = 0", t, ct);
        var categoriesToCreate = await Int(db, """
            SELECT COUNT(*) AS Value FROM (SELECT DISTINCT p.CategoryId FROM [pos].[products] p WHERE p.TenantId = @t AND p.IsDeleted = 0) u
            LEFT JOIN [pos].[product_categories] pc ON pc.Id = u.CategoryId
            WHERE NOT EXISTS (SELECT 1 FROM [inventory].[product_categories] c WHERE c.Id = u.CategoryId AND c.TenantId = @t AND c.IsDeleted = 0)
              AND NOT EXISTS (SELECT 1 FROM [inventory].[product_categories] c WHERE c.TenantId = @t AND c.IsDeleted = 0 AND c.Name = pc.Name)
            """, t, ct);
        var withBranch = await Int(db, """
            SELECT COUNT(DISTINCT b.ProductId) AS Value FROM [pos].[branch_stock] b
            JOIN [pos].[products] p ON p.Id = b.ProductId AND p.IsDeleted = 0
            WHERE b.TenantId = @t AND b.IsDeleted = 0
            """, t, ct);
        var negative = await Int(db, """
            SELECT COUNT(*) AS Value FROM [pos].[products] p
            WHERE p.TenantId = @t AND p.IsDeleted = 0
              AND (p.StockQuantity < 0 OR EXISTS (SELECT 1 FROM [pos].[branch_stock] b WHERE b.ProductId = p.Id AND b.IsDeleted = 0 AND b.StockQuantity < 0))
            """, t, ct);
        var headUnits = await Dec(db, "SELECT ISNULL(SUM(StockQuantity), 0) AS Value FROM [pos].[products] WHERE TenantId = @t AND IsDeleted = 0", t, ct);
        var branchUnits = await Dec(db, """
            SELECT ISNULL(SUM(b.StockQuantity), 0) AS Value FROM [pos].[branch_stock] b
            JOIN [pos].[products] p ON p.Id = b.ProductId AND p.IsDeleted = 0
            WHERE b.TenantId = @t AND b.IsDeleted = 0
            """, t, ct);

        var skuClashes = await db.Database.SqlQueryRaw<ClashRow>("""
            SELECT p.Id AS PosProductId, p.Name AS PosName, p.SKU AS Value, i.Id AS InventoryProductId, i.Name AS InventoryName
            FROM [pos].[products] p
            JOIN [inventory].[products] i ON i.TenantId = @t AND i.IsDeleted = 0 AND i.Id <> p.Id AND i.SKU = p.SKU
            WHERE p.TenantId = @t AND p.IsDeleted = 0 AND p.SKU IS NOT NULL
            """, T(t)).ToListAsync(ct);
        var barcodeClashes = await db.Database.SqlQueryRaw<ClashRow>("""
            SELECT p.Id AS PosProductId, p.Name AS PosName, p.Barcode AS Value, i.Id AS InventoryProductId, i.Name AS InventoryName
            FROM [pos].[products] p
            JOIN [inventory].[products] i ON i.TenantId = @t AND i.IsDeleted = 0 AND i.Id <> p.Id AND i.Barcode = p.Barcode
            WHERE p.TenantId = @t AND p.IsDeleted = 0 AND p.Barcode IS NOT NULL
            """, T(t)).ToListAsync(ct);

        var branches = (await db.Database.SqlQueryRaw<BranchRow>("""
            SELECT b.BranchId, br.Name,
                   CAST(CASE WHEN EXISTS (SELECT 1 FROM [inventory].[warehouses] w WHERE w.TenantId = @t AND w.IsDeleted = 0 AND w.BranchId = b.BranchId) THEN 1 ELSE 0 END AS bit) AS HasWarehouse,
                   COUNT(DISTINCT b.ProductId) AS Products, ISNULL(SUM(b.StockQuantity), 0) AS Units
            FROM [pos].[branch_stock] b
            JOIN [pos].[products] p ON p.Id = b.ProductId AND p.IsDeleted = 0
            LEFT JOIN [identity].[branches] br ON br.Id = b.BranchId
            WHERE b.TenantId = @t AND b.IsDeleted = 0
            GROUP BY b.BranchId, br.Name
            """, T(t)).ToListAsync(ct))
            .Select(r => new MoveBranchDto(r.BranchId, r.Name ?? "Unknown branch", r.HasWarehouse, r.Products, r.Units)).ToList();

        var needsMain = posProducts > 0 && !await db.Database.SqlQueryRaw<IntRow>(
            "SELECT COUNT(*) AS Value FROM [inventory].[warehouses] WHERE TenantId = @t AND IsDeleted = 0 AND BranchId IS NULL", T(t))
            .AnyAsync(r => r.Value > 0, ct);

        // ── What stops a move ──────────────────────────────────────────────────────────────────────
        var blockers = new List<string>();
        if (tenant.IsMirror)
            blockers.Add("This workspace is the cloud mirror of an on-premises installation. Move the catalogue on the on-premises server, not here.");
        // Branch servers: the sync carries Inventory (catalogue down, a branch warehouse's stock up), but a branch
        // that is not in touch cannot be seen to have received the move, and stock it sold but has not uploaded
        // would be missing from the opening balances. Every branch server must have uploaded in the last 15 minutes.
        var silentBranches = tenant.BranchServersEnabled
            ? await BranchesNotInContactAsync(db, t, ct)
            : [];
        if (silentBranches.Count > 0)
            blockers.Add("This workspace runs branch servers, and these have not uploaded in the last 15 minutes (or have errors): "
                         + string.Join(", ", silentBranches)
                         + ". Wait until every branch server has synced, then check again.");
        if (posProducts == 0)
            blockers.Add(invProducts > 0 ? "The catalogue is already in Inventory." : "There are no POS products to move.");
        if (deletedTwins > 0)
            blockers.Add($"{deletedTwins} product(s) share an id with a deleted Inventory product. Restore or purge those first.");
        if (skuClashes.Count > 0)
            blockers.Add($"{skuClashes.Count} product(s) have a SKU that a different Inventory product already uses. Rename one of each pair, then check again.");
        if (barcodeClashes.Count > 0)
            blockers.Add($"{barcodeClashes.Count} product(s) have a barcode that a different Inventory product already uses; the till could not tell them apart. Resolve each pair, then check again.");

        var warnings = new List<string>();
        if (negative > 0) warnings.Add($"{negative} product(s) have negative stock (at head office or in a branch). It is carried over as it is.");
        if (withBranch > 0)
            warnings.Add("Stock becomes one total per product: head-office stock plus every branch's stock, with each part held in its own warehouse. Branch sales will reduce that total, as they do for any Inventory product.");
        if (branches.Any(b => !b.HasWarehouse))
            warnings.Add("A warehouse is created for each branch that has none, named after the branch.");
        if (already > 0)
            warnings.Add($"{already} product(s) already exist in Inventory under the same id; they are left exactly as they are and not counted as moved.");
        if (tenant.BranchServersEnabled)
            warnings.Add("Branch servers: each branch receives the catalogue and its own warehouse's opening stock on its next sync. Do the move when the tills are closed - a sale a branch has made but not yet uploaded is not in the opening balance, and a branch cannot trade on Inventory stock until it has synced once.");
        warnings.Add("POS stock history stays where it is as read-only history. The POS rows are kept (marked as moved) and are not deleted.");

        var state = posProducts > 0 ? "on_pos" : invProducts > 0 ? "on_inventory" : "empty";
        return new CatalogueMovePreviewDto(
            t, tenant.Name, state, blockers.Count == 0, blockers, warnings,
            new MoveCountsDto(posProducts, already, categoriesUsed, categoriesToCreate, withBranch, negative),
            headUnits, branchUnits, needsMain, branches,
            skuClashes.Select(c => new SkuClashDto(c.PosProductId, c.PosName, c.Value, c.InventoryProductId, c.InventoryName)).ToList(),
            barcodeClashes.Select(c => new SkuClashDto(c.PosProductId, c.PosName, c.Value, c.InventoryProductId, c.InventoryName)).ToList());
    }

    private sealed class ResultRow
    {
        public int Moved { get; set; } public int CategoriesCreated { get; set; }
        public int WarehousesCreated { get; set; } public int StockBuckets { get; set; }
        public DateTime MovedAt { get; set; }
    }

    /// <summary>
    /// The move itself — one transaction. See the class remarks. The per-workspace application lock stops two
    /// operators (or a retried request) running it at once.
    /// </summary>
    public static async Task<CatalogueMoveRecordDto> RunAsync(
        InventoryDbContext db, Guid t, string by, string reportJson, int livePos, CancellationToken ct)
    {
        const string sql = """
            SET XACT_ABORT ON; SET QUOTED_IDENTIFIER ON; SET NOCOUNT ON;
            BEGIN TRAN;

            DECLARE @lock INT, @res NVARCHAR(100) = N'catalogue-move:' + CONVERT(NVARCHAR(36), @t);
            EXEC @lock = sp_getapplock @Resource = @res, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 0;
            IF @lock < 0 THROW 51000, 'Another catalogue move for this workspace is already running.', 1;

            DECLARE @now DATETIME2 = SYSUTCDATETIME();

            -- 1. Categories: every category the POS products use, matched by id, then by name, else created.
            CREATE TABLE #catmap (PosId UNIQUEIDENTIFIER PRIMARY KEY, InvId UNIQUEIDENTIFIER NOT NULL, Created BIT NOT NULL);
            INSERT #catmap (PosId, InvId, Created)
            SELECT u.CategoryId,
                   COALESCE(byid.Id, byname.Id, CASE WHEN anyid.Id IS NOT NULL THEN NEWID() ELSE u.CategoryId END),
                   CASE WHEN byid.Id IS NULL AND byname.Id IS NULL THEN 1 ELSE 0 END
            FROM (SELECT DISTINCT CategoryId FROM [pos].[products] WHERE TenantId = @t AND IsDeleted = 0) u
            LEFT JOIN [pos].[product_categories] pc ON pc.Id = u.CategoryId
            LEFT JOIN [inventory].[product_categories] byid ON byid.Id = u.CategoryId AND byid.TenantId = @t AND byid.IsDeleted = 0
            OUTER APPLY (SELECT TOP 1 c.Id FROM [inventory].[product_categories] c
                         WHERE c.TenantId = @t AND c.IsDeleted = 0 AND pc.Name IS NOT NULL AND c.Name = pc.Name ORDER BY c.CreatedAt) byname
            LEFT JOIN [inventory].[product_categories] anyid ON anyid.Id = u.CategoryId;

            INSERT [inventory].[product_categories] (Id, Name, Description, IsActive, CreatedAt, IsDeleted, TenantId)
            SELECT m.InvId, COALESCE(pc.Name, N'Imported products'), pc.Description, 1, @now, 0, @t
            FROM #catmap m LEFT JOIN [pos].[product_categories] pc ON pc.Id = m.PosId WHERE m.Created = 1;
            DECLARE @catsCreated INT = (SELECT COUNT(*) FROM #catmap WHERE Created = 1);

            -- 2. The head-office warehouse: an existing one that belongs to no branch, else a new "Main Warehouse".
            DECLARE @whCreated INT = 0;
            DECLARE @mainWh UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM [inventory].[warehouses]
                WHERE TenantId = @t AND IsDeleted = 0 AND BranchId IS NULL ORDER BY IsDefault DESC, CreatedAt);
            IF @mainWh IS NULL
            BEGIN
                SET @mainWh = NEWID();
                INSERT [inventory].[warehouses] (Id, Name, Code, Address, ContactPerson, Phone, IsActive, IsDefault, CreatedAt, IsDeleted, TenantId, BranchId)
                VALUES (@mainWh, N'Main Warehouse', NULL, NULL, NULL, NULL, 1,
                        CASE WHEN EXISTS (SELECT 1 FROM [inventory].[warehouses] WHERE TenantId = @t AND IsDeleted = 0 AND IsDefault = 1) THEN 0 ELSE 1 END,
                        @now, 0, @t, NULL);
                SET @whCreated += 1;
            END

            -- 3. Products — same ids. Only those not already in Inventory.
            CREATE TABLE #moved (Id UNIQUEIDENTIFIER PRIMARY KEY, HeadQty DECIMAL(18,4) NOT NULL, ReorderLevel DECIMAL(18,4) NOT NULL);
            INSERT #moved (Id, HeadQty, ReorderLevel)
            SELECT p.Id, p.StockQuantity, p.ReorderLevel FROM [pos].[products] p
            WHERE p.TenantId = @t AND p.IsDeleted = 0 AND NOT EXISTS (SELECT 1 FROM [inventory].[products] i WHERE i.Id = p.Id);

            INSERT [inventory].[products]
                (Id, Name, Description, SKU, Barcode, CategoryId, SalePrice, CostPrice, TaxRate, Unit, StockQuantity, ReorderLevel,
                 TrackInventory, IsActive, ImageUrl, CreatedAt, UpdatedAt, IsDeleted, BrandId, UnitOfMeasureId, TenantId, SellOnline)
            SELECT p.Id, p.Name, p.Description, p.SKU, p.Barcode, m.InvId, p.SalePrice, p.CostPrice, p.TaxRate, p.Unit,
                   p.StockQuantity + ISNULL(bs.Qty, 0), p.ReorderLevel,
                   p.TrackInventory, p.IsActive, p.ImageUrl, p.CreatedAt, @now, 0, NULL, NULL, @t, 1
            FROM [pos].[products] p
            JOIN #moved mv ON mv.Id = p.Id
            JOIN #catmap m ON m.PosId = p.CategoryId
            LEFT JOIN (SELECT ProductId, SUM(StockQuantity) AS Qty FROM [pos].[branch_stock]
                       WHERE TenantId = @t AND IsDeleted = 0 GROUP BY ProductId) bs ON bs.ProductId = p.Id;
            DECLARE @moved INT = @@ROWCOUNT;

            -- 4. Stock: head-office stock in the head-office warehouse, each branch's in its own.
            INSERT [inventory].[product_stock] (Id, ProductId, WarehouseId, Quantity, ReorderLevel, CreatedAt, TenantId)
            SELECT NEWID(), mv.Id, @mainWh, mv.HeadQty, mv.ReorderLevel, @now, @t FROM #moved mv WHERE mv.HeadQty <> 0;
            DECLARE @buckets INT = @@ROWCOUNT;

            CREATE TABLE #br (BranchId UNIQUEIDENTIFIER PRIMARY KEY, WhId UNIQUEIDENTIFIER NULL, Created BIT NOT NULL);
            INSERT #br (BranchId, WhId, Created)
            SELECT b.BranchId, w.Id, 0
            FROM (SELECT DISTINCT BranchId FROM [pos].[branch_stock]
                  WHERE TenantId = @t AND IsDeleted = 0 AND ProductId IN (SELECT Id FROM #moved)) b
            OUTER APPLY (SELECT TOP 1 Id FROM [inventory].[warehouses]
                         WHERE TenantId = @t AND IsDeleted = 0 AND BranchId = b.BranchId ORDER BY IsDefault DESC, CreatedAt) w;
            UPDATE #br SET WhId = NEWID(), Created = 1 WHERE WhId IS NULL;

            INSERT [inventory].[warehouses] (Id, Name, Code, Address, ContactPerson, Phone, IsActive, IsDefault, CreatedAt, IsDeleted, TenantId, BranchId)
            SELECT r.WhId, ISNULL(br.Name + N' stock', N'Branch stock'), NULL, NULL, NULL, NULL, 1, 0, @now, 0, @t, r.BranchId
            FROM #br r LEFT JOIN [identity].[branches] br ON br.Id = r.BranchId WHERE r.Created = 1;
            SET @whCreated += (SELECT COUNT(*) FROM #br WHERE Created = 1);

            INSERT [inventory].[product_stock] (Id, ProductId, WarehouseId, Quantity, ReorderLevel, CreatedAt, TenantId)
            SELECT NEWID(), bs.ProductId, r.WhId, bs.StockQuantity, 0, @now, @t
            FROM [pos].[branch_stock] bs JOIN #br r ON r.BranchId = bs.BranchId
            WHERE bs.TenantId = @t AND bs.IsDeleted = 0 AND bs.ProductId IN (SELECT Id FROM #moved);
            SET @buckets += @@ROWCOUNT;

            -- 5. Retire the POS rows. They are kept, marked as moved, so nothing is lost.
            UPDATE [pos].[products] SET IsDeleted = 1, DeletedAt = @now, DeletedBy = N'moved-to-inventory'
            WHERE TenantId = @t AND IsDeleted = 0;

            -- 6. The record of what was done.
            INSERT [inventory].[catalogue_moves] (Id, ProductsMoved, AlreadyThere, CategoriesCreated, WarehousesCreated, StockBuckets, MovedBy, MovedAt, Report, TenantId)
            VALUES (NEWID(), @moved, @livePos - @moved, @catsCreated, @whCreated, @buckets, @by, @now, @report, @t);

            COMMIT;
            SELECT @moved AS Moved, @catsCreated AS CategoriesCreated, @whCreated AS WarehousesCreated, @buckets AS StockBuckets, @now AS MovedAt;
            """;

        var rows = await db.Database.SqlQueryRaw<ResultRow>(sql,
            T(t), new SqlParameter("@by", by), new SqlParameter("@report", reportJson), new SqlParameter("@livePos", livePos))
            .ToListAsync(ct);
        var r = rows.First();
        return new CatalogueMoveRecordDto(r.MovedAt, by, r.Moved, livePos - r.Moved, r.CategoriesCreated, r.WarehousesCreated, r.StockBuckets);
    }
}

internal sealed class GetCatalogueMoveStatusHandler(InventoryDbContext db)
    : IQueryHandler<GetCatalogueMoveStatusQuery, CatalogueMoveStatusDto>
{
    public async Task<Result<CatalogueMoveStatusDto>> Handle(GetCatalogueMoveStatusQuery q, CancellationToken ct)
    {
        var s = await CatalogueMoveSupport.StatusAsync(db, q.TenantId, ct);
        return s is null ? Result.Failure<CatalogueMoveStatusDto>(CatalogueMoveSupport.NoTenant) : Result.Success(s);
    }
}

internal sealed class PreviewCatalogueMoveHandler(InventoryDbContext db)
    : IQueryHandler<PreviewCatalogueMoveQuery, CatalogueMovePreviewDto>
{
    public async Task<Result<CatalogueMovePreviewDto>> Handle(PreviewCatalogueMoveQuery q, CancellationToken ct)
    {
        var p = await CatalogueMoveSupport.PreviewAsync(db, q.TenantId, ct);
        return p is null ? Result.Failure<CatalogueMovePreviewDto>(CatalogueMoveSupport.NoTenant) : Result.Success(p);
    }
}

internal sealed class RunCatalogueMoveHandler(InventoryDbContext db)
    : ICommandHandler<RunCatalogueMoveCommand, CatalogueMoveRecordDto>
{
    public async Task<Result<CatalogueMoveRecordDto>> Handle(RunCatalogueMoveCommand cmd, CancellationToken ct)
    {
        // Checked again here, in the same request: what the operator saw a minute ago may have changed.
        var preview = await CatalogueMoveSupport.PreviewAsync(db, cmd.TenantId, ct);
        if (preview is null) return Result.Failure<CatalogueMoveRecordDto>(CatalogueMoveSupport.NoTenant);
        if (!preview.CanMove)
            return Result.Failure<CatalogueMoveRecordDto>(
                Error.Custom("CatalogueMove.Conflict", "The catalogue cannot be moved: " + string.Join(" ", preview.Blockers)));

        try
        {
            var record = await CatalogueMoveSupport.RunAsync(
                db, cmd.TenantId, cmd.MovedBy, JsonSerializer.Serialize(preview), preview.Counts.PosProducts, ct);
            return Result.Success(record);
        }
        catch (SqlException ex) when (ex.Number == 51000)
        {
            return Result.Failure<CatalogueMoveRecordDto>(Error.Custom("CatalogueMove.Conflict", ex.Message));
        }
    }
}

internal sealed class GetCatalogueMoveOverviewHandler(InventoryDbContext db)
    : IQueryHandler<GetCatalogueMoveOverviewQuery, CatalogueMoveOverviewDto>
{
    private sealed class Row
    {
        public Guid TenantId { get; set; } public string Name { get; set; } = "";
        public int PosProducts { get; set; } public int InventoryProducts { get; set; }
        public bool BranchServersEnabled { get; set; } public bool IsMirror { get; set; }
    }

    public async Task<Result<CatalogueMoveOverviewDto>> Handle(GetCatalogueMoveOverviewQuery q, CancellationToken ct)
    {
        var rows = await db.Database.SqlQueryRaw<Row>("""
            SELECT t.Id AS TenantId, t.Name, t.BranchServersEnabled, t.IsMirror,
                   (SELECT COUNT(*) FROM [pos].[products] p WHERE p.TenantId = t.Id AND p.IsDeleted = 0) AS PosProducts,
                   (SELECT COUNT(*) FROM [inventory].[products] i WHERE i.TenantId = t.Id AND i.IsDeleted = 0) AS InventoryProducts
            FROM [identity].[tenants] t
            WHERE t.IsDeleted = 0
              AND EXISTS (SELECT 1 FROM [pos].[products] p WHERE p.TenantId = t.Id AND p.IsDeleted = 0)
            ORDER BY t.Name
            """).ToListAsync(ct);

        var list = rows.Select(r => new StillOnPosDto(r.TenantId, r.Name, r.PosProducts, r.InventoryProducts, r.BranchServersEnabled, r.IsMirror)).ToList();
        return Result.Success(new CatalogueMoveOverviewDto(list.Count, list));
    }
}
