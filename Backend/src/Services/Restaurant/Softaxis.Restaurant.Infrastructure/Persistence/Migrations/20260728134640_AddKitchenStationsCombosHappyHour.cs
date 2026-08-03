using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKitchenStationsCombosHappyHour : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CurrentCourse",
                schema: "restaurant",
                table: "Orders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ComboOrderItemId",
                schema: "restaurant",
                table: "OrderItems",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CourseNumber",
                schema: "restaurant",
                table: "OrderItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "KitchenStationId",
                schema: "restaurant",
                table: "MenuItems",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "KitchenStationId",
                schema: "restaurant",
                table: "MenuCategories",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Combos",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Combos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HappyHourRules",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DaysOfWeekMask = table.Column<int>(type: "int", nullable: false),
                    StartTime = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    EndTime = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    DiscountType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DiscountValue = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HappyHourRules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KitchenStations",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ColorTag = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    PrinterProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KitchenStations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PrinterProfiles",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ConnectionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IpAddress = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Port = table.Column<int>(type: "int", nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrinterProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ComboItems",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ComboId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MenuItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComboItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComboItems_Combos_ComboId",
                        column: x => x.ComboId,
                        principalSchema: "restaurant",
                        principalTable: "Combos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_ComboOrderItemId",
                schema: "restaurant",
                table: "OrderItems",
                column: "ComboOrderItemId");

            migrationBuilder.CreateIndex(
                name: "IX_MenuItems_KitchenStationId",
                schema: "restaurant",
                table: "MenuItems",
                column: "KitchenStationId");

            migrationBuilder.CreateIndex(
                name: "IX_ComboItems_ComboId",
                schema: "restaurant",
                table: "ComboItems",
                column: "ComboId");

            migrationBuilder.CreateIndex(
                name: "IX_ComboItems_TenantId",
                schema: "restaurant",
                table: "ComboItems",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Combos_TenantId",
                schema: "restaurant",
                table: "Combos",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_HappyHourRules_BranchId",
                schema: "restaurant",
                table: "HappyHourRules",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_HappyHourRules_TenantId",
                schema: "restaurant",
                table: "HappyHourRules",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_KitchenStations_BranchId",
                schema: "restaurant",
                table: "KitchenStations",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_KitchenStations_PrinterProfileId",
                schema: "restaurant",
                table: "KitchenStations",
                column: "PrinterProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_KitchenStations_TenantId",
                schema: "restaurant",
                table: "KitchenStations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PrinterProfiles_BranchId",
                schema: "restaurant",
                table: "PrinterProfiles",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_PrinterProfiles_TenantId",
                schema: "restaurant",
                table: "PrinterProfiles",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ComboItems",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "HappyHourRules",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "KitchenStations",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "PrinterProfiles",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "Combos",
                schema: "restaurant");

            migrationBuilder.DropIndex(
                name: "IX_OrderItems_ComboOrderItemId",
                schema: "restaurant",
                table: "OrderItems");

            migrationBuilder.DropIndex(
                name: "IX_MenuItems_KitchenStationId",
                schema: "restaurant",
                table: "MenuItems");

            migrationBuilder.DropColumn(
                name: "CurrentCourse",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ComboOrderItemId",
                schema: "restaurant",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "CourseNumber",
                schema: "restaurant",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "KitchenStationId",
                schema: "restaurant",
                table: "MenuItems");

            migrationBuilder.DropColumn(
                name: "KitchenStationId",
                schema: "restaurant",
                table: "MenuCategories");
        }
    }
}
