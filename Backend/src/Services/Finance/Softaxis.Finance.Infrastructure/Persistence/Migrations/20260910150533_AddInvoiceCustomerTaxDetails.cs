using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceCustomerTaxDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomerAddress",
                schema: "finance",
                table: "recurring_invoices",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerTrn",
                schema: "finance",
                table: "recurring_invoices",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerAddress",
                schema: "finance",
                table: "invoices",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerTrn",
                schema: "finance",
                table: "invoices",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomerAddress",
                schema: "finance",
                table: "recurring_invoices");

            migrationBuilder.DropColumn(
                name: "CustomerTrn",
                schema: "finance",
                table: "recurring_invoices");

            migrationBuilder.DropColumn(
                name: "CustomerAddress",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "CustomerTrn",
                schema: "finance",
                table: "invoices");
        }
    }
}
