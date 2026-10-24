using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMenuItemBranchSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MenuItemBranchSettings",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MenuItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PriceOverride = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    IsAvailable = table.Column<bool>(type: "bit", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MenuItemBranchSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MenuItemBranchSettings_BranchId",
                schema: "restaurant",
                table: "MenuItemBranchSettings",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_MenuItemBranchSettings_MenuItemId_BranchId",
                schema: "restaurant",
                table: "MenuItemBranchSettings",
                columns: new[] { "MenuItemId", "BranchId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MenuItemBranchSettings_TenantId",
                schema: "restaurant",
                table: "MenuItemBranchSettings",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MenuItemBranchSettings",
                schema: "restaurant");
        }
    }
}
