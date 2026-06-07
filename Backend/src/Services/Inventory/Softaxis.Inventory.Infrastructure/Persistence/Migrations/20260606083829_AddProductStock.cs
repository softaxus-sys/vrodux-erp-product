using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Inventory.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProductStock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "product_stock",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WarehouseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    ReorderLevel = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_stock", x => x.Id);
                    table.ForeignKey(
                        name: "FK_product_stock_products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "inventory",
                        principalTable: "products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_product_stock_warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalSchema: "inventory",
                        principalTable: "warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_product_stock_ProductId_WarehouseId",
                schema: "inventory",
                table: "product_stock",
                columns: new[] { "ProductId", "WarehouseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_stock_WarehouseId",
                schema: "inventory",
                table: "product_stock",
                column: "WarehouseId");

            // Backfill: seed each existing product's current global stock into the
            // default warehouse (or, if none is flagged default, the first warehouse).
            migrationBuilder.Sql(@"
                DECLARE @wh UNIQUEIDENTIFIER = (
                    SELECT TOP 1 Id FROM inventory.warehouses
                    WHERE IsDeleted = 0
                    ORDER BY CASE WHEN IsDefault = 1 THEN 0 ELSE 1 END, CreatedAt);

                IF @wh IS NOT NULL
                INSERT INTO inventory.product_stock (Id, ProductId, WarehouseId, Quantity, ReorderLevel, CreatedAt)
                SELECT NEWID(), p.Id, @wh, p.StockQuantity, p.ReorderLevel, SYSUTCDATETIME()
                FROM inventory.products p
                WHERE p.IsDeleted = 0;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "product_stock",
                schema: "inventory");
        }
    }
}
