using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Manufacturing.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTrackingByProductsCapacity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CapacityHoursPerDay",
                schema: "manufacturing",
                table: "work_centres",
                type: "decimal(6,2)",
                precision: 6,
                scale: 2,
                nullable: false,
                defaultValue: 8m);

            migrationBuilder.AddColumn<string>(
                name: "BatchNumber",
                schema: "manufacturing",
                table: "production_orders",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExpiryDate",
                schema: "manufacturing",
                table: "production_orders",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentOrderId",
                schema: "manufacturing",
                table: "production_orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ParentOrderNumber",
                schema: "manufacturing",
                table: "production_orders",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequisitionNumber",
                schema: "manufacturing",
                table: "production_orders",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ScrapCost",
                schema: "manufacturing",
                table: "production_orders",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "alert_state",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LastDigestDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alert_state", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bom_by_products",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ProductSku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bom_by_products", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bom_by_products_boms_BomId",
                        column: x => x.BomId,
                        principalSchema: "manufacturing",
                        principalTable: "boms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "production_material_issues",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductionOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ComponentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    BatchNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_production_material_issues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_production_material_issues_production_orders_ProductionOrderId",
                        column: x => x.ProductionOrderId,
                        principalSchema: "manufacturing",
                        principalTable: "production_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "production_order_outputs",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductionOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Sku = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Unit = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    PlannedQuantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    ReceivedQuantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_production_order_outputs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_production_order_outputs_production_orders_ProductionOrderId",
                        column: x => x.ProductionOrderId,
                        principalSchema: "manufacturing",
                        principalTable: "production_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_production_orders_ParentOrderId",
                schema: "manufacturing",
                table: "production_orders",
                column: "ParentOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_production_orders_Reference",
                schema: "manufacturing",
                table: "production_orders",
                column: "Reference");

            migrationBuilder.CreateIndex(
                name: "IX_alert_state_TenantId",
                schema: "manufacturing",
                table: "alert_state",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_bom_by_products_BomId",
                schema: "manufacturing",
                table: "bom_by_products",
                column: "BomId");

            migrationBuilder.CreateIndex(
                name: "IX_bom_by_products_TenantId",
                schema: "manufacturing",
                table: "bom_by_products",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_production_material_issues_BatchNumber",
                schema: "manufacturing",
                table: "production_material_issues",
                column: "BatchNumber");

            migrationBuilder.CreateIndex(
                name: "IX_production_material_issues_ProductId",
                schema: "manufacturing",
                table: "production_material_issues",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_production_material_issues_ProductionOrderId",
                schema: "manufacturing",
                table: "production_material_issues",
                column: "ProductionOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_production_material_issues_TenantId",
                schema: "manufacturing",
                table: "production_material_issues",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_production_order_outputs_ProductionOrderId",
                schema: "manufacturing",
                table: "production_order_outputs",
                column: "ProductionOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_production_order_outputs_TenantId",
                schema: "manufacturing",
                table: "production_order_outputs",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "alert_state",
                schema: "manufacturing");

            migrationBuilder.DropTable(
                name: "bom_by_products",
                schema: "manufacturing");

            migrationBuilder.DropTable(
                name: "production_material_issues",
                schema: "manufacturing");

            migrationBuilder.DropTable(
                name: "production_order_outputs",
                schema: "manufacturing");

            migrationBuilder.DropIndex(
                name: "IX_production_orders_ParentOrderId",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropIndex(
                name: "IX_production_orders_Reference",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "CapacityHoursPerDay",
                schema: "manufacturing",
                table: "work_centres");

            migrationBuilder.DropColumn(
                name: "BatchNumber",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "ExpiryDate",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "ParentOrderId",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "ParentOrderNumber",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "RequisitionNumber",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "ScrapCost",
                schema: "manufacturing",
                table: "production_orders");
        }
    }
}
