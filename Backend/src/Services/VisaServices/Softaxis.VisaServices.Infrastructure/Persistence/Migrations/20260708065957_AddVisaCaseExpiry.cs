using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.VisaServices.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVisaCaseExpiry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "VisaExpiryDate",
                schema: "visa",
                table: "visa_cases",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "VisaExpiryDate",
                schema: "visa",
                table: "visa_cases");
        }
    }
}
