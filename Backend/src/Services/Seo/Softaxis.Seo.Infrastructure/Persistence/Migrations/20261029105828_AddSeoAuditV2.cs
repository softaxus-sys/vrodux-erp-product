using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Seo.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSeoAuditV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LastPagesCrawled",
                schema: "seo",
                table: "seo_sites",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LastScore",
                schema: "seo",
                table: "seo_sites",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AffectedCount",
                schema: "seo",
                table: "seo_issues",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "Code",
                schema: "seo",
                table: "seo_issues",
                type: "nvarchar(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DetailsJson",
                schema: "seo",
                table: "seo_issues",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Fingerprint",
                schema: "seo",
                table: "seo_issues",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "FirstSeenAt",
                schema: "seo",
                table: "seo_issues",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSeenAt",
                schema: "seo",
                table: "seo_issues",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "CreditsCharged",
                schema: "seo",
                table: "seo_audits",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CriticalCount",
                schema: "seo",
                table: "seo_audits",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "DurationMs",
                schema: "seo",
                table: "seo_audits",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "HighCount",
                schema: "seo",
                table: "seo_audits",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LowCount",
                schema: "seo",
                table: "seo_audits",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MediumCount",
                schema: "seo",
                table: "seo_audits",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "NewIssues",
                schema: "seo",
                table: "seo_audits",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PagesCrawled",
                schema: "seo",
                table: "seo_audits",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ResolvedIssues",
                schema: "seo",
                table: "seo_audits",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Score",
                schema: "seo",
                table: "seo_audits",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Truncated",
                schema: "seo",
                table: "seo_audits",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "seo_credit_ledger",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<int>(type: "int", nullable: false),
                    BalanceAfter = table.Column<long>(type: "bigint", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    RefType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    RefId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    ActorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_credit_ledger", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_pages",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuditId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Url = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    FinalUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    StatusCode = table.Column<int>(type: "int", nullable: false),
                    RedirectHops = table.Column<int>(type: "int", nullable: false),
                    ResponseMs = table.Column<int>(type: "int", nullable: false),
                    HtmlBytes = table.Column<int>(type: "int", nullable: false),
                    Depth = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    MetaDescription = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    H1 = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    WordCount = table.Column<int>(type: "int", nullable: false),
                    Indexable = table.Column<bool>(type: "bit", nullable: false),
                    InSitemap = table.Column<bool>(type: "bit", nullable: false),
                    InternalLinksIn = table.Column<int>(type: "int", nullable: false),
                    InternalLinksOut = table.Column<int>(type: "int", nullable: false),
                    IssueCount = table.Column<int>(type: "int", nullable: false),
                    Error = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_pages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_wallets",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Balance = table.Column<long>(type: "bigint", nullable: false),
                    LifetimeAdded = table.Column<long>(type: "bigint", nullable: false),
                    LifetimeSpent = table.Column<long>(type: "bigint", nullable: false),
                    WelcomeGranted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_wallets", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_seo_issues_SiteId_Fingerprint",
                schema: "seo",
                table: "seo_issues",
                columns: new[] { "SiteId", "Fingerprint" });

            migrationBuilder.CreateIndex(
                name: "IX_seo_audits_SiteId_StartedAt",
                schema: "seo",
                table: "seo_audits",
                columns: new[] { "SiteId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_seo_credit_ledger_TenantId",
                schema: "seo",
                table: "seo_credit_ledger",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_credit_ledger_TenantId_IdempotencyKey",
                schema: "seo",
                table: "seo_credit_ledger",
                columns: new[] { "TenantId", "IdempotencyKey" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_seo_pages_AuditId",
                schema: "seo",
                table: "seo_pages",
                column: "AuditId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_pages_SiteId_AuditId",
                schema: "seo",
                table: "seo_pages",
                columns: new[] { "SiteId", "AuditId" });

            migrationBuilder.CreateIndex(
                name: "IX_seo_pages_TenantId",
                schema: "seo",
                table: "seo_pages",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_wallets_TenantId",
                schema: "seo",
                table: "seo_wallets",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            // Issues from before audits kept history: they were first and last seen when they were detected.
            migrationBuilder.Sql("UPDATE [seo].[seo_issues] SET [FirstSeenAt] = [DetectedAt], [LastSeenAt] = [DetectedAt]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "seo_credit_ledger",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_pages",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_wallets",
                schema: "seo");

            migrationBuilder.DropIndex(
                name: "IX_seo_issues_SiteId_Fingerprint",
                schema: "seo",
                table: "seo_issues");

            migrationBuilder.DropIndex(
                name: "IX_seo_audits_SiteId_StartedAt",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "LastPagesCrawled",
                schema: "seo",
                table: "seo_sites");

            migrationBuilder.DropColumn(
                name: "LastScore",
                schema: "seo",
                table: "seo_sites");

            migrationBuilder.DropColumn(
                name: "AffectedCount",
                schema: "seo",
                table: "seo_issues");

            migrationBuilder.DropColumn(
                name: "Code",
                schema: "seo",
                table: "seo_issues");

            migrationBuilder.DropColumn(
                name: "DetailsJson",
                schema: "seo",
                table: "seo_issues");

            migrationBuilder.DropColumn(
                name: "Fingerprint",
                schema: "seo",
                table: "seo_issues");

            migrationBuilder.DropColumn(
                name: "FirstSeenAt",
                schema: "seo",
                table: "seo_issues");

            migrationBuilder.DropColumn(
                name: "LastSeenAt",
                schema: "seo",
                table: "seo_issues");

            migrationBuilder.DropColumn(
                name: "CreditsCharged",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "CriticalCount",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "DurationMs",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "HighCount",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "LowCount",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "MediumCount",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "NewIssues",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "PagesCrawled",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "ResolvedIssues",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "Score",
                schema: "seo",
                table: "seo_audits");

            migrationBuilder.DropColumn(
                name: "Truncated",
                schema: "seo",
                table: "seo_audits");
        }
    }
}
