using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStructuredModifiers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MenuItemModifierGroups",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MenuItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModifierGroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MenuItemModifierGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModifierGroups",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MinSelect = table.Column<int>(type: "int", nullable: false),
                    MaxSelect = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModifierGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrderItemModifiers",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModifierId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PriceDelta = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderItemModifiers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderItemModifiers_OrderItems_OrderItemId",
                        column: x => x.OrderItemId,
                        principalSchema: "restaurant",
                        principalTable: "OrderItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Modifiers",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModifierGroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PriceDelta = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Modifiers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Modifiers_ModifierGroups_ModifierGroupId",
                        column: x => x.ModifierGroupId,
                        principalSchema: "restaurant",
                        principalTable: "ModifierGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MenuItemModifierGroups_MenuItemId",
                schema: "restaurant",
                table: "MenuItemModifierGroups",
                column: "MenuItemId");

            migrationBuilder.CreateIndex(
                name: "IX_MenuItemModifierGroups_MenuItemId_ModifierGroupId",
                schema: "restaurant",
                table: "MenuItemModifierGroups",
                columns: new[] { "MenuItemId", "ModifierGroupId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MenuItemModifierGroups_TenantId",
                schema: "restaurant",
                table: "MenuItemModifierGroups",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ModifierGroups_TenantId",
                schema: "restaurant",
                table: "ModifierGroups",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Modifiers_ModifierGroupId",
                schema: "restaurant",
                table: "Modifiers",
                column: "ModifierGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_Modifiers_TenantId",
                schema: "restaurant",
                table: "Modifiers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItemModifiers_OrderItemId",
                schema: "restaurant",
                table: "OrderItemModifiers",
                column: "OrderItemId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItemModifiers_TenantId",
                schema: "restaurant",
                table: "OrderItemModifiers",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MenuItemModifierGroups",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "Modifiers",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "OrderItemModifiers",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "ModifierGroups",
                schema: "restaurant");
        }
    }
}
