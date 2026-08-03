using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFloorLayoutAndTableOps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                schema: "restaurant",
                table: "Tables",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DiningAreaId",
                schema: "restaurant",
                table: "Tables",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "MergedIntoTableId",
                schema: "restaurant",
                table: "Tables",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "PosX",
                schema: "restaurant",
                table: "Tables",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "PosY",
                schema: "restaurant",
                table: "Tables",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Rotation",
                schema: "restaurant",
                table: "Tables",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Shape",
                schema: "restaurant",
                table: "Tables",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "square");

            migrationBuilder.AddColumn<string>(
                name: "ArrivalWindowEnd",
                schema: "restaurant",
                table: "Reservations",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ArrivalWindowStart",
                schema: "restaurant",
                table: "Reservations",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                schema: "restaurant",
                table: "Reservations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NoShowAt",
                schema: "restaurant",
                table: "Reservations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DiningAreas",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FloorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiningAreas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Floors",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Floors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ReservationRules",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SlotDurationMinutes = table.Column<int>(type: "int", nullable: false),
                    MaxCoversPerSlot = table.Column<int>(type: "int", nullable: false),
                    MaxAdvanceDays = table.Column<int>(type: "int", nullable: false),
                    MinNoticeMinutes = table.Column<int>(type: "int", nullable: false),
                    AutoNoShowMinutes = table.Column<int>(type: "int", nullable: false),
                    DepositRequired = table.Column<bool>(type: "bit", nullable: false),
                    DepositAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReservationRules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TableTransferLogs",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromTableId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ToTableId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TransferredByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TableTransferLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WaitlistEntries",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    GuestName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    GuestPhone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PartySize = table.Column<int>(type: "int", nullable: false),
                    QuotedWaitMinutes = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ArrivedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SeatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TableId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WaitlistEntries", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tables_BranchId",
                schema: "restaurant",
                table: "Tables",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Tables_DiningAreaId",
                schema: "restaurant",
                table: "Tables",
                column: "DiningAreaId");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_BranchId",
                schema: "restaurant",
                table: "Reservations",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_ReservationDate_Status",
                schema: "restaurant",
                table: "Reservations",
                columns: new[] { "ReservationDate", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_DiningAreas_FloorId",
                schema: "restaurant",
                table: "DiningAreas",
                column: "FloorId");

            migrationBuilder.CreateIndex(
                name: "IX_DiningAreas_TenantId",
                schema: "restaurant",
                table: "DiningAreas",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Floors_BranchId",
                schema: "restaurant",
                table: "Floors",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Floors_TenantId",
                schema: "restaurant",
                table: "Floors",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReservationRules_BranchId",
                schema: "restaurant",
                table: "ReservationRules",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_ReservationRules_TenantId",
                schema: "restaurant",
                table: "ReservationRules",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TableTransferLogs_OrderId",
                schema: "restaurant",
                table: "TableTransferLogs",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_TableTransferLogs_TenantId",
                schema: "restaurant",
                table: "TableTransferLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_WaitlistEntries_BranchId",
                schema: "restaurant",
                table: "WaitlistEntries",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_WaitlistEntries_Status",
                schema: "restaurant",
                table: "WaitlistEntries",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_WaitlistEntries_TenantId",
                schema: "restaurant",
                table: "WaitlistEntries",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DiningAreas",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "Floors",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "ReservationRules",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "TableTransferLogs",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "WaitlistEntries",
                schema: "restaurant");

            migrationBuilder.DropIndex(
                name: "IX_Tables_BranchId",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropIndex(
                name: "IX_Tables_DiningAreaId",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_BranchId",
                schema: "restaurant",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_ReservationDate_Status",
                schema: "restaurant",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BranchId",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "DiningAreaId",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "MergedIntoTableId",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "PosX",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "PosY",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "Rotation",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "Shape",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "ArrivalWindowEnd",
                schema: "restaurant",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "ArrivalWindowStart",
                schema: "restaurant",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BranchId",
                schema: "restaurant",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "NoShowAt",
                schema: "restaurant",
                table: "Reservations");
        }
    }
}
