using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUnitDetailFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Bathrooms",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Bedrooms",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Furnishing",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Parking",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "ServiceCharge",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "View",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Bathrooms",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "Bedrooms",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "Furnishing",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "Notes",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "Parking",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "ServiceCharge",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "View",
                schema: "real_estate",
                table: "PropertyUnits");
        }
    }
}
