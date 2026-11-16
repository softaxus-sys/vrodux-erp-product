using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Seo.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileAutofill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AutofillNote",
                schema: "seo",
                table: "seo_business_profiles",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AutofillStatus",
                schema: "seo",
                table: "seo_business_profiles",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "none");

            migrationBuilder.AddColumn<bool>(
                name: "IsDraft",
                schema: "seo",
                table: "seo_business_profiles",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutofillNote",
                schema: "seo",
                table: "seo_business_profiles");

            migrationBuilder.DropColumn(
                name: "AutofillStatus",
                schema: "seo",
                table: "seo_business_profiles");

            migrationBuilder.DropColumn(
                name: "IsDraft",
                schema: "seo",
                table: "seo_business_profiles");
        }
    }
}
