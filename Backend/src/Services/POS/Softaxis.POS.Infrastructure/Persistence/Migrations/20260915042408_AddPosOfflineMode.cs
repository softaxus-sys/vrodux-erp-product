using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPosOfflineMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClientRef",
                schema: "pos",
                table: "pos_transactions",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OfflineReceiptNumber",
                schema: "pos",
                table: "pos_transactions",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClientRef",
                schema: "pos",
                table: "pos_sessions",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClientRef",
                schema: "pos",
                table: "cash_movements",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "offline_sync_batches",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RegisterId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SyncedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionCount = table.Column<int>(type: "int", nullable: false),
                    AppliedCount = table.Column<int>(type: "int", nullable: false),
                    DuplicateCount = table.Column<int>(type: "int", nullable: false),
                    RejectedCount = table.Column<int>(type: "int", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
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
                    table.PrimaryKey("PK_offline_sync_batches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pos_settings",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OfflineModeEnabled = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
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
                    table.PrimaryKey("PK_pos_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pos_till_status",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DeviceId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RegisterId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PendingRecords = table.Column<int>(type: "int", nullable: false),
                    UnsyncedShifts = table.Column<int>(type: "int", nullable: false),
                    ReportedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
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
                    table.PrimaryKey("PK_pos_till_status", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pos_transactions_TenantId_ClientRef",
                schema: "pos",
                table: "pos_transactions",
                columns: new[] { "TenantId", "ClientRef" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [ClientRef] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_pos_sessions_TenantId_ClientRef",
                schema: "pos",
                table: "pos_sessions",
                columns: new[] { "TenantId", "ClientRef" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [ClientRef] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_cash_movements_TenantId_ClientRef",
                schema: "pos",
                table: "cash_movements",
                columns: new[] { "TenantId", "ClientRef" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [ClientRef] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_offline_sync_batches_LastSyncedAt",
                schema: "pos",
                table: "offline_sync_batches",
                column: "LastSyncedAt");

            migrationBuilder.CreateIndex(
                name: "IX_offline_sync_batches_TenantId",
                schema: "pos",
                table: "offline_sync_batches",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pos_settings_TenantId",
                schema: "pos",
                table: "pos_settings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pos_till_status_TenantId",
                schema: "pos",
                table: "pos_till_status",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pos_till_status_TenantId_DeviceId",
                schema: "pos",
                table: "pos_till_status",
                columns: new[] { "TenantId", "DeviceId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "offline_sync_batches",
                schema: "pos");

            migrationBuilder.DropTable(
                name: "pos_settings",
                schema: "pos");

            migrationBuilder.DropTable(
                name: "pos_till_status",
                schema: "pos");

            migrationBuilder.DropIndex(
                name: "IX_pos_transactions_TenantId_ClientRef",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropIndex(
                name: "IX_pos_sessions_TenantId_ClientRef",
                schema: "pos",
                table: "pos_sessions");

            migrationBuilder.DropIndex(
                name: "IX_cash_movements_TenantId_ClientRef",
                schema: "pos",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "ClientRef",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "OfflineReceiptNumber",
                schema: "pos",
                table: "pos_transactions");

            migrationBuilder.DropColumn(
                name: "ClientRef",
                schema: "pos",
                table: "pos_sessions");

            migrationBuilder.DropColumn(
                name: "ClientRef",
                schema: "pos",
                table: "cash_movements");
        }
    }
}
