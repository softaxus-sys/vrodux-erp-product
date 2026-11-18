using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoicePaymentDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentInstructions",
                schema: "finance",
                table: "recurring_invoices",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentLink",
                schema: "finance",
                table: "recurring_invoices",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                schema: "finance",
                table: "recurring_invoices",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentInstructions",
                schema: "finance",
                table: "invoices",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentLink",
                schema: "finance",
                table: "invoices",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                schema: "finance",
                table: "invoices",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentInstructions",
                schema: "finance",
                table: "recurring_invoices");

            migrationBuilder.DropColumn(
                name: "PaymentLink",
                schema: "finance",
                table: "recurring_invoices");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                schema: "finance",
                table: "recurring_invoices");

            migrationBuilder.DropColumn(
                name: "PaymentInstructions",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "PaymentLink",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                schema: "finance",
                table: "invoices");
        }
    }
}
