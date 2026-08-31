using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EmergencyContact",
                schema: "real_estate",
                table: "Tenants",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyIncome",
                schema: "real_estate",
                table: "Tenants",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: "real_estate",
                table: "Tenants",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Occupation",
                schema: "real_estate",
                table: "Tenants",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PassportNumber",
                schema: "real_estate",
                table: "Tenants",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Trn",
                schema: "real_estate",
                table: "Tenants",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmergencyContact",
                schema: "real_estate",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "MonthlyIncome",
                schema: "real_estate",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "Notes",
                schema: "real_estate",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "Occupation",
                schema: "real_estate",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "PassportNumber",
                schema: "real_estate",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "Trn",
                schema: "real_estate",
                table: "Tenants");
        }
    }
}
