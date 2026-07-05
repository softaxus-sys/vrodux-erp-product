using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDealForecasting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ForecastCategory",
                schema: "crm",
                table: "deals",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "pipeline");

            migrationBuilder.AddColumn<string>(
                name: "LossReason",
                schema: "crm",
                table: "deals",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ForecastCategory",
                schema: "crm",
                table: "deals");

            migrationBuilder.DropColumn(
                name: "LossReason",
                schema: "crm",
                table: "deals");
        }
    }
}
