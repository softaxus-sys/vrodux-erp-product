using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Manufacturing.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialManufacturing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "manufacturing");

            migrationBuilder.CreateTable(
                name: "boms",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BomNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ProductSku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OutputQuantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "draft"),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_boms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "production_orders",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    BomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BomNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ProductSku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Unit = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    PlannedQuantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    ProducedQuantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    WarehouseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    WarehouseName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "planned"),
                    PlannedStartDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    DueDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ReleasedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    MaterialCost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_production_orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bom_lines",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ComponentProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ComponentName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ComponentSku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ScrapPercent = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bom_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bom_lines_boms_BomId",
                        column: x => x.BomId,
                        principalSchema: "manufacturing",
                        principalTable: "boms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "production_order_components",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductionOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Sku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RequiredQuantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    IssuedQuantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_production_order_components", x => x.Id);
                    table.ForeignKey(
                        name: "FK_production_order_components_production_orders_ProductionOrderId",
                        column: x => x.ProductionOrderId,
                        principalSchema: "manufacturing",
                        principalTable: "production_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bom_lines_BomId",
                schema: "manufacturing",
                table: "bom_lines",
                column: "BomId");

            migrationBuilder.CreateIndex(
                name: "IX_bom_lines_ComponentProductId",
                schema: "manufacturing",
                table: "bom_lines",
                column: "ComponentProductId");

            migrationBuilder.CreateIndex(
                name: "IX_bom_lines_TenantId",
                schema: "manufacturing",
                table: "bom_lines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_boms_ProductId",
                schema: "manufacturing",
                table: "boms",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_boms_Status",
                schema: "manufacturing",
                table: "boms",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_boms_TenantId",
                schema: "manufacturing",
                table: "boms",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_boms_TenantId_BomNumber",
                schema: "manufacturing",
                table: "boms",
                columns: new[] { "TenantId", "BomNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_production_order_components_ProductId",
                schema: "manufacturing",
                table: "production_order_components",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_production_order_components_ProductionOrderId",
                schema: "manufacturing",
                table: "production_order_components",
                column: "ProductionOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_production_order_components_TenantId",
                schema: "manufacturing",
                table: "production_order_components",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_production_orders_BomId",
                schema: "manufacturing",
                table: "production_orders",
                column: "BomId");

            migrationBuilder.CreateIndex(
                name: "IX_production_orders_ProductId",
                schema: "manufacturing",
                table: "production_orders",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_production_orders_Status",
                schema: "manufacturing",
                table: "production_orders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_production_orders_TenantId",
                schema: "manufacturing",
                table: "production_orders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_production_orders_TenantId_OrderNumber",
                schema: "manufacturing",
                table: "production_orders",
                columns: new[] { "TenantId", "OrderNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bom_lines",
                schema: "manufacturing");

            migrationBuilder.DropTable(
                name: "production_order_components",
                schema: "manufacturing");

            migrationBuilder.DropTable(
                name: "boms",
                schema: "manufacturing");

            migrationBuilder.DropTable(
                name: "production_orders",
                schema: "manufacturing");
        }
    }
}
