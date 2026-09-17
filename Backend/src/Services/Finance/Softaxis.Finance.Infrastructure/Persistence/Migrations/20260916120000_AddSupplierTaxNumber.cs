using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierTaxNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TaxNumber",
                schema: "finance",
                table: "suppliers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TaxNumber",
                schema: "finance",
                table: "suppliers");
        }
    }
}
