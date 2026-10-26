using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchStock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                schema: "pos",
                table: "stock_movements",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "branch_stock",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StockQuantity = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branch_stock", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_branch_stock_BranchId",
                schema: "pos",
                table: "branch_stock",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_branch_stock_ProductId",
                schema: "pos",
                table: "branch_stock",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_branch_stock_TenantId",
                schema: "pos",
                table: "branch_stock",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_branch_stock_TenantId_BranchId_ProductId",
                schema: "pos",
                table: "branch_stock",
                columns: new[] { "TenantId", "BranchId", "ProductId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "branch_stock",
                schema: "pos");

            migrationBuilder.DropColumn(
                name: "BranchId",
                schema: "pos",
                table: "stock_movements");
        }
    }
}
