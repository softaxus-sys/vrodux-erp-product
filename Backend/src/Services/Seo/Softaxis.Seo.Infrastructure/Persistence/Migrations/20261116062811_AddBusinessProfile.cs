using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Seo.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBusinessProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FitReason",
                schema: "seo",
                table: "seo_plan_items",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Summary",
                schema: "seo",
                table: "seo_plan_items",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "seo_business_profiles",
                schema: "seo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Industry = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Summary = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: false),
                    OffersJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Audience = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ServiceAreas = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    AvoidTopicsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ImportedFromTenantAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seo_business_profiles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_seo_business_profiles_SiteId",
                schema: "seo",
                table: "seo_business_profiles",
                column: "SiteId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_seo_business_profiles_TenantId",
                schema: "seo",
                table: "seo_business_profiles",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "seo_business_profiles",
                schema: "seo");

            migrationBuilder.DropColumn(
                name: "FitReason",
                schema: "seo",
                table: "seo_plan_items");

            migrationBuilder.DropColumn(
                name: "Summary",
                schema: "seo",
                table: "seo_plan_items");
        }
    }
}
