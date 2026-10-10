using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Manufacturing.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRoutingCostingAndQuality : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "JournalEntryId",
                schema: "manufacturing",
                table: "production_orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JournalEntryNumber",
                schema: "manufacturing",
                table: "production_orders",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LabourCost",
                schema: "manufacturing",
                table: "production_orders",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "OverheadCost",
                schema: "manufacturing",
                table: "production_orders",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "QualityNotes",
                schema: "manufacturing",
                table: "production_orders",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ScrappedQuantity",
                schema: "manufacturing",
                table: "production_orders",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "bom_operations",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Sequence = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    WorkCentreId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WorkCentreName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SetupMinutes = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    RunMinutesPerBatch = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    LabourRate = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    OverheadRate = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bom_operations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bom_operations_boms_BomId",
                        column: x => x.BomId,
                        principalSchema: "manufacturing",
                        principalTable: "boms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "production_order_operations",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductionOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Sequence = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    WorkCentreId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WorkCentreName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PlannedMinutes = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ActualMinutes = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    LabourRate = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    OverheadRate = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    IsDone = table.Column<bool>(type: "bit", nullable: false),
                    DoneAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_production_order_operations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_production_order_operations_production_orders_ProductionOrderId",
                        column: x => x.ProductionOrderId,
                        principalSchema: "manufacturing",
                        principalTable: "production_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "work_centres",
                schema: "manufacturing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    LabourRatePerHour = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    OverheadRatePerHour = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_centres", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bom_operations_BomId",
                schema: "manufacturing",
                table: "bom_operations",
                column: "BomId");

            migrationBuilder.CreateIndex(
                name: "IX_bom_operations_TenantId",
                schema: "manufacturing",
                table: "bom_operations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_bom_operations_WorkCentreId",
                schema: "manufacturing",
                table: "bom_operations",
                column: "WorkCentreId");

            migrationBuilder.CreateIndex(
                name: "IX_production_order_operations_ProductionOrderId",
                schema: "manufacturing",
                table: "production_order_operations",
                column: "ProductionOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_production_order_operations_TenantId",
                schema: "manufacturing",
                table: "production_order_operations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_production_order_operations_WorkCentreId",
                schema: "manufacturing",
                table: "production_order_operations",
                column: "WorkCentreId");

            migrationBuilder.CreateIndex(
                name: "IX_work_centres_TenantId",
                schema: "manufacturing",
                table: "work_centres",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bom_operations",
                schema: "manufacturing");

            migrationBuilder.DropTable(
                name: "production_order_operations",
                schema: "manufacturing");

            migrationBuilder.DropTable(
                name: "work_centres",
                schema: "manufacturing");

            migrationBuilder.DropColumn(
                name: "JournalEntryId",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "JournalEntryNumber",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "LabourCost",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "OverheadCost",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "QualityNotes",
                schema: "manufacturing",
                table: "production_orders");

            migrationBuilder.DropColumn(
                name: "ScrappedQuantity",
                schema: "manufacturing",
                table: "production_orders");
        }
    }
}
