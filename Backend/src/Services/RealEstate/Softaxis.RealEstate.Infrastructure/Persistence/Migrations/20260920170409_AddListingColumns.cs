using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddListingColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AgentName",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AreaLabel",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BedsLabel",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasMedia",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsListed",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ListedBy",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ListedOn",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerName",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerPhone",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerPhoneAlt",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PriceLabel",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Purpose",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                schema: "real_estate",
                table: "Properties",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "residential");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyUnits_Purpose",
                schema: "real_estate",
                table: "PropertyUnits",
                column: "Purpose");

            // ── Backfill ──────────────────────────────────────────────────────
            // PropertyType used to hold the broad bucket — literally "residential", "commercial"
            // or "mixed" — because the two ideas shared one column. Category takes that job over,
            // so the value has to be moved across before the type column is cleaned up, or every
            // existing property would land in the default bucket and the portfolio tiles would
            // report the whole book as residential.
            migrationBuilder.Sql("""
                UPDATE [real_estate].[Properties]
                SET [Category] = CASE
                        WHEN LOWER([PropertyType]) LIKE 'commerc%' THEN 'commercial'
                        WHEN LOWER([PropertyType]) LIKE 'mixed%'   THEN 'mixed'
                        ELSE 'residential'
                    END;
                """);

            // Now the type column says what the property IS. Only the three bare codes are
            // rewritten — anything else was already a real type ("Apartment", "Villa") and is left
            // exactly as the workspace wrote it. The replacements are the same words the old form
            // showed for each code, so nothing appears to change for a property already on screen.
            migrationBuilder.Sql("""
                UPDATE [real_estate].[Properties]
                SET [PropertyType] = CASE LOWER([PropertyType])
                        WHEN 'residential' THEN 'Residential Tower'
                        WHEN 'commercial'  THEN 'Commercial Building'
                        WHEN 'mixed'       THEN 'Mixed-Use'
                        ELSE [PropertyType]
                    END
                WHERE LOWER([PropertyType]) IN ('residential', 'commercial', 'mixed');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PropertyUnits_Purpose",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "AgentName",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "AreaLabel",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "BedsLabel",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "HasMedia",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "IsListed",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "ListedBy",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "ListedOn",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "OwnerName",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "OwnerPhone",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "OwnerPhoneAlt",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "PriceLabel",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "Purpose",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "Category",
                schema: "real_estate",
                table: "Properties");
        }
    }
}
