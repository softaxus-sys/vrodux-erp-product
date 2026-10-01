using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUnitRentedUntil : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RentedUntil",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VacancyAlertKey",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RentedUntil",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "VacancyAlertKey",
                schema: "real_estate",
                table: "PropertyUnits");
        }
    }
}
