using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceIntegrationCenter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "integration_account_mappings",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integration_account_mappings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "integration_settings",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Mode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    StartDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    LastSyncAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastSyncError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integration_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "posting_items",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    SourceModule = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    SourceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SourceDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CurrencyCode = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    AmountsJson = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    LastAttemptAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    JournalEntryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    JournalEntryNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PostedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PostedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_posting_items", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_integration_account_mappings_TenantId",
                schema: "finance",
                table: "integration_account_mappings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_integration_account_mappings_TenantId_IntegrationKey_Role",
                schema: "finance",
                table: "integration_account_mappings",
                columns: new[] { "TenantId", "IntegrationKey", "Role" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_integration_settings_TenantId",
                schema: "finance",
                table: "integration_settings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_integration_settings_TenantId_IntegrationKey",
                schema: "finance",
                table: "integration_settings",
                columns: new[] { "TenantId", "IntegrationKey" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_posting_items_JournalEntryId",
                schema: "finance",
                table: "posting_items",
                column: "JournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_posting_items_Status",
                schema: "finance",
                table: "posting_items",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_posting_items_TenantId",
                schema: "finance",
                table: "posting_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_posting_items_TenantId_IntegrationKey_SourceId",
                schema: "finance",
                table: "posting_items",
                columns: new[] { "TenantId", "IntegrationKey", "SourceId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "integration_account_mappings",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "integration_settings",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "posting_items",
                schema: "finance");
        }
    }
}
