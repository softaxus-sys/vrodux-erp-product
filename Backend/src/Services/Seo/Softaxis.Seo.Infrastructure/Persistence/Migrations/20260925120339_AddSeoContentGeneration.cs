using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Seo.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSeoContentGeneration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "seo_articles",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    MetaDescription = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    TargetKeyword = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    BodyMarkdown = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    WordCount = table.Column<int>(type: "int", nullable: false),
                    SourceSignalsJson = table.Column<string>(type: "nvarchar(max)", nullable: false, defaultValue: "[]"),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "pending_review"),
                    ReviewedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReviewedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    WordPressPostId = table.Column<int>(type: "int", nullable: true),
                    PushedToWordPressAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_articles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_content_settings",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    Frequency = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "weekly"),
                    ArticlesPerRun = table.Column<int>(type: "int", nullable: false),
                    TargetWordCount = table.Column<int>(type: "int", nullable: false),
                    NicheHint = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CompetitorDomainsCsv = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    NextRunAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastRunAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_content_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "seo_wordpress_connections",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Username = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    AppPassword = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "connected"),
                    LastError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AutoPublish = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_wordpress_connections", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_seo_articles_SiteId",
                schema: "seo",
                table: "seo_articles",
                column: "SiteId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_articles_SiteId_Status",
                schema: "seo",
                table: "seo_articles",
                columns: new[] { "SiteId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_seo_articles_TenantId",
                schema: "seo",
                table: "seo_articles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_content_settings_SiteId",
                schema: "seo",
                table: "seo_content_settings",
                column: "SiteId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_seo_content_settings_TenantId",
                schema: "seo",
                table: "seo_content_settings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_seo_wordpress_connections_SiteId",
                schema: "seo",
                table: "seo_wordpress_connections",
                column: "SiteId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_seo_wordpress_connections_TenantId",
                schema: "seo",
                table: "seo_wordpress_connections",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "seo_articles",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_content_settings",
                schema: "seo");

            migrationBuilder.DropTable(
                name: "seo_wordpress_connections",
                schema: "seo");
        }
    }
}
