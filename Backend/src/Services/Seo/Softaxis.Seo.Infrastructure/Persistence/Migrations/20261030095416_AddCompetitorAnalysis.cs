using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Seo.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCompetitorAnalysis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "seo_competitor_scans",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LocationCode = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CompetitorsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PagesCrawled = table.Column<int>(type: "int", nullable: false),
                    CreditsCharged = table.Column<int>(type: "int", nullable: false),
                    KeywordDataUsed = table.Column<bool>(type: "bit", nullable: false),
                    KeywordDataNote = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TopicGapsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    KeywordGapsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Error = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_competitor_scans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_competitors",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Domain = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_competitors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_keyword_snapshots",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Domain = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    IsOwn = table.Column<bool>(type: "bit", nullable: false),
                    LocationCode = table.Column<int>(type: "int", nullable: false),
                    ItemsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ItemCount = table.Column<int>(type: "int", nullable: false),
                    FetchedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_keyword_snapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_plan_items",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ScanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlannedDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    TargetKeyword = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: false),
                    SearchVolume = table.Column<int>(type: "int", nullable: true),
                    Difficulty = table.Column<int>(type: "int", nullable: true),
                    Source = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ArticleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_plan_items", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_seo_competitor_scans_SiteId_CreatedAt",
                schema: "seo",
                table: "seo_competitor_scans",
                columns: new[] { "SiteId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_seo_competitor_scans_TenantId",
                schema: "seo",
                table: "seo_competitor_scans",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_competitors_SiteId_Domain",
                schema: "seo",
                table: "seo_competitors",
                columns: new[] { "SiteId", "Domain" });

            migrationBuilder.CreateIndex(
                name: "IX_seo_competitors_TenantId",
                schema: "seo",
                table: "seo_competitors",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_keyword_snapshots_SiteId_Domain_LocationCode_FetchedAt",
                schema: "seo",
                table: "seo_keyword_snapshots",
                columns: new[] { "SiteId", "Domain", "LocationCode", "FetchedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_seo_keyword_snapshots_TenantId",
                schema: "seo",
                table: "seo_keyword_snapshots",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_plan_items_SiteId_ScanId",
                schema: "seo",
                table: "seo_plan_items",
                columns: new[] { "SiteId", "ScanId" });

            migrationBuilder.CreateIndex(
                name: "IX_seo_plan_items_TenantId",
                schema: "seo",
                table: "seo_plan_items",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "seo_competitor_scans",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_competitors",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_keyword_snapshots",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_plan_items",
                schema: "seo");
        }
    }
}
