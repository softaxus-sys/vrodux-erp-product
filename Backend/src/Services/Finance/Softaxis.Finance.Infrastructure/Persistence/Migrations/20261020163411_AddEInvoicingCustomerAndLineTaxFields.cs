using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEInvoicingCustomerAndLineTaxFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExemptionReason",
                schema: "finance",
                table: "invoice_items",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaxCategory",
                schema: "finance",
                table: "invoice_items",
                type: "nvarchar(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UnitCode",
                schema: "finance",
                table: "invoice_items",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "City",
                schema: "finance",
                table: "customers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CountryCode",
                schema: "finance",
                table: "customers",
                type: "nvarchar(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Emirate",
                schema: "finance",
                table: "customers",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PeppolId",
                schema: "finance",
                table: "customers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Trn",
                schema: "finance",
                table: "customers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExemptionReason",
                schema: "finance",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "TaxCategory",
                schema: "finance",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "UnitCode",
                schema: "finance",
                table: "invoice_items");

            migrationBuilder.DropColumn(
                name: "City",
                schema: "finance",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "CountryCode",
                schema: "finance",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Emirate",
                schema: "finance",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "PeppolId",
                schema: "finance",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Trn",
                schema: "finance",
                table: "customers");
        }
    }
}
