using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMetaConversions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "meta_conversion_events",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LeadId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DealId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    EventName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EventTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MetaLeadId = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    UserDataJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meta_conversion_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "meta_conversion_settings",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    DatasetId = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    AccessToken = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    LeadEvents = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DealEvents = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SendDealValue = table.Column<bool>(type: "bit", nullable: false),
                    DefaultCallingCode = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    DatasetName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    LastVerifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EnabledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastSentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastFailureAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meta_conversion_settings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_meta_conversion_events_IntegrationId_CreatedAt",
                schema: "crm",
                table: "meta_conversion_events",
                columns: new[] { "IntegrationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_meta_conversion_events_IntegrationId_LeadId",
                schema: "crm",
                table: "meta_conversion_events",
                columns: new[] { "IntegrationId", "LeadId" });

            migrationBuilder.CreateIndex(
                name: "IX_meta_conversion_events_Status_NextAttemptAt",
                schema: "crm",
                table: "meta_conversion_events",
                columns: new[] { "Status", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_meta_conversion_events_TenantId",
                schema: "crm",
                table: "meta_conversion_events",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_meta_conversion_settings_IntegrationId",
                schema: "crm",
                table: "meta_conversion_settings",
                column: "IntegrationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_meta_conversion_settings_TenantId",
                schema: "crm",
                table: "meta_conversion_settings",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "meta_conversion_events",
                schema: "crm");

            migrationBuilder.DropTable(
                name: "meta_conversion_settings",
                schema: "crm");
        }
    }
}
