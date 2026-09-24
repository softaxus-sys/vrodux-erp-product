using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Seo.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSeo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "seo");

            migrationBuilder.CreateTable(
                name: "seo_audits",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "running"),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IssuesFound = table.Column<int>(type: "int", nullable: false),
                    FixesProposed = table.Column<int>(type: "int", nullable: false),
                    Error = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_audits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_fixes",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IssueId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PageUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ChangeType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ProposedValueJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Rationale = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "pending_review"),
                    ReviewedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReviewedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AppliedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_fixes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_google_integrations",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "disconnected"),
                    Credentials = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_google_integrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_google_resources",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ResourceType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ExternalId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_google_resources", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_issues",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuditId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Severity = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    PageUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "open"),
                    DetectedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_issues", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_sites",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Domain = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SnippetKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    ScanFrequency = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "weekly"),
                    NextScanAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    VerificationStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "pending"),
                    VerifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastSeenAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastScanAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_sites", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_seo_audits_SiteId",
                schema: "seo",
                table: "seo_audits",
                column: "SiteId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_audits_TenantId",
                schema: "seo",
                table: "seo_audits",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_fixes_IssueId",
                schema: "seo",
                table: "seo_fixes",
                column: "IssueId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_fixes_SiteId_Status",
                schema: "seo",
                table: "seo_fixes",
                columns: new[] { "SiteId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_seo_fixes_Status",
                schema: "seo",
                table: "seo_fixes",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_seo_fixes_TenantId",
                schema: "seo",
                table: "seo_fixes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_google_integrations_SiteId",
                schema: "seo",
                table: "seo_google_integrations",
                column: "SiteId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_google_integrations_TenantId",
                schema: "seo",
                table: "seo_google_integrations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_google_resources_IntegrationId",
                schema: "seo",
                table: "seo_google_resources",
                column: "IntegrationId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_google_resources_TenantId",
                schema: "seo",
                table: "seo_google_resources",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_issues_AuditId",
                schema: "seo",
                table: "seo_issues",
                column: "AuditId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_issues_SiteId",
                schema: "seo",
                table: "seo_issues",
                column: "SiteId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_issues_Status",
                schema: "seo",
                table: "seo_issues",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_seo_issues_TenantId",
                schema: "seo",
                table: "seo_issues",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_sites_SnippetKey",
                schema: "seo",
                table: "seo_sites",
                column: "SnippetKey");

            migrationBuilder.CreateIndex(
                name: "IX_seo_sites_TenantId",
                schema: "seo",
                table: "seo_sites",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "seo_audits",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_fixes",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_google_integrations",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_google_resources",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_issues",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_sites",
                schema: "seo");
        }
    }
}
