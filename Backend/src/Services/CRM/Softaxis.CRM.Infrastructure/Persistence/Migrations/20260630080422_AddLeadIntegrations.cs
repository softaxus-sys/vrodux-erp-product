using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadIntegrations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "integration_raw_leads",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ExternalId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Payload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedLeadId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReceivedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NextAttemptAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integration_raw_leads", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "integration_sync_logs",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Trigger = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Fetched = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<int>(type: "int", nullable: false),
                    Duplicates = table.Column<int>(type: "int", nullable: false),
                    Failed = table.Column<int>(type: "int", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integration_sync_logs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "integrations",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "disconnected"),
                    Health = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "unknown"),
                    Config = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Credentials = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    InboundKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SigningSecret = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DedupeConfig = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RoutingConfig = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastSyncAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastSuccessAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastFailureAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RetryCount = table.Column<int>(type: "int", nullable: false),
                    RoutingCursor = table.Column<int>(type: "int", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "lead_sources",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LeadId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ProviderKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ExternalLeadId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Campaign = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CampaignId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AdSetId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AdId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PageId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FormId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UtmSource = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UtmMedium = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UtmCampaign = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UtmTerm = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UtmContent = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RawJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReceivedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lead_sources", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "integration_field_mappings",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceField = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TargetField = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integration_field_mappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_integration_field_mappings_integrations_IntegrationId",
                        column: x => x.IntegrationId,
                        principalSchema: "crm",
                        principalTable: "integrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "integration_resources",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ResourceType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    ExternalId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ParentExternalId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    AccessToken = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integration_resources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_integration_resources_integrations_IntegrationId",
                        column: x => x.IntegrationId,
                        principalSchema: "crm",
                        principalTable: "integrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_integration_field_mappings_IntegrationId",
                schema: "crm",
                table: "integration_field_mappings",
                column: "IntegrationId");

            migrationBuilder.CreateIndex(
                name: "IX_integration_field_mappings_TenantId",
                schema: "crm",
                table: "integration_field_mappings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_integration_raw_leads_IntegrationId_ExternalId",
                schema: "crm",
                table: "integration_raw_leads",
                columns: new[] { "IntegrationId", "ExternalId" });

            migrationBuilder.CreateIndex(
                name: "IX_integration_raw_leads_IntegrationId_ReceivedAt",
                schema: "crm",
                table: "integration_raw_leads",
                columns: new[] { "IntegrationId", "ReceivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_integration_raw_leads_Status_NextAttemptAt",
                schema: "crm",
                table: "integration_raw_leads",
                columns: new[] { "Status", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_integration_raw_leads_TenantId",
                schema: "crm",
                table: "integration_raw_leads",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_integration_resources_IntegrationId",
                schema: "crm",
                table: "integration_resources",
                column: "IntegrationId");

            migrationBuilder.CreateIndex(
                name: "IX_integration_resources_IntegrationId_ResourceType",
                schema: "crm",
                table: "integration_resources",
                columns: new[] { "IntegrationId", "ResourceType" });

            migrationBuilder.CreateIndex(
                name: "IX_integration_resources_TenantId",
                schema: "crm",
                table: "integration_resources",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_integration_sync_logs_IntegrationId_StartedAt",
                schema: "crm",
                table: "integration_sync_logs",
                columns: new[] { "IntegrationId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_integration_sync_logs_TenantId",
                schema: "crm",
                table: "integration_sync_logs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_integrations_InboundKey",
                schema: "crm",
                table: "integrations",
                column: "InboundKey");

            migrationBuilder.CreateIndex(
                name: "IX_integrations_ProviderKey",
                schema: "crm",
                table: "integrations",
                column: "ProviderKey");

            migrationBuilder.CreateIndex(
                name: "IX_integrations_TenantId",
                schema: "crm",
                table: "integrations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_lead_sources_LeadId",
                schema: "crm",
                table: "lead_sources",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_lead_sources_ProviderKey_ExternalLeadId",
                schema: "crm",
                table: "lead_sources",
                columns: new[] { "ProviderKey", "ExternalLeadId" });

            migrationBuilder.CreateIndex(
                name: "IX_lead_sources_TenantId",
                schema: "crm",
                table: "lead_sources",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "integration_field_mappings",
                schema: "crm");

            migrationBuilder.DropTable(
                name: "integration_raw_leads",
                schema: "crm");

            migrationBuilder.DropTable(
                name: "integration_resources",
                schema: "crm");

            migrationBuilder.DropTable(
                name: "integration_sync_logs",
                schema: "crm");

            migrationBuilder.DropTable(
                name: "lead_sources",
                schema: "crm");

            migrationBuilder.DropTable(
                name: "integrations",
                schema: "crm");
        }
    }
}
