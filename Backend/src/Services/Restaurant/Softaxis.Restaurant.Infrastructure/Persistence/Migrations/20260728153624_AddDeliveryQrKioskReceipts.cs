using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDeliveryQrKioskReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "QrCode",
                schema: "restaurant",
                table: "Tables",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValueSql: "REPLACE(CONVERT(nvarchar(64), NEWID()), '-', '')");

            migrationBuilder.AddColumn<string>(
                name: "OrderChannel",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "pos");

            migrationBuilder.AddColumn<bool>(
                name: "IsOnlineOrderable",
                schema: "restaurant",
                table: "MenuItems",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "DeliveryOrders",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DeliveryZoneId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DriverId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EstimatedDeliveryAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeliveredAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeliveryFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ThirdPartyProvider = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ThirdPartyOrderRef = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TrackingToken = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeliveryOrders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DeliveryZones",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PostalCodesJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DeliveryFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MinOrderAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    EstimatedMinutes = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeliveryZones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DigitalReceiptLogs",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RecipientAddress = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ErrorMessage = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DigitalReceiptLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Drivers",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LinkedUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    VehicleInfo = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Drivers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TableOrderingSessions",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TableId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GuestDeviceToken = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastActivityAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TableOrderingSessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tables_QrCode",
                schema: "restaurant",
                table: "Tables",
                column: "QrCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryOrders_DriverId",
                schema: "restaurant",
                table: "DeliveryOrders",
                column: "DriverId");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryOrders_OrderId",
                schema: "restaurant",
                table: "DeliveryOrders",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryOrders_TenantId",
                schema: "restaurant",
                table: "DeliveryOrders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryOrders_TrackingToken",
                schema: "restaurant",
                table: "DeliveryOrders",
                column: "TrackingToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryZones_BranchId",
                schema: "restaurant",
                table: "DeliveryZones",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryZones_TenantId",
                schema: "restaurant",
                table: "DeliveryZones",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_DigitalReceiptLogs_OrderId",
                schema: "restaurant",
                table: "DigitalReceiptLogs",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_DigitalReceiptLogs_TenantId",
                schema: "restaurant",
                table: "DigitalReceiptLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Drivers_BranchId",
                schema: "restaurant",
                table: "Drivers",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Drivers_TenantId",
                schema: "restaurant",
                table: "Drivers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TableOrderingSessions_GuestDeviceToken",
                schema: "restaurant",
                table: "TableOrderingSessions",
                column: "GuestDeviceToken");

            migrationBuilder.CreateIndex(
                name: "IX_TableOrderingSessions_TableId",
                schema: "restaurant",
                table: "TableOrderingSessions",
                column: "TableId");

            migrationBuilder.CreateIndex(
                name: "IX_TableOrderingSessions_TenantId",
                schema: "restaurant",
                table: "TableOrderingSessions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DeliveryOrders",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "DeliveryZones",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "DigitalReceiptLogs",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "Drivers",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "TableOrderingSessions",
                schema: "restaurant");

            migrationBuilder.DropIndex(
                name: "IX_Tables_QrCode",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "QrCode",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "OrderChannel",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "IsOnlineOrderable",
                schema: "restaurant",
                table: "MenuItems");
        }
    }
}
