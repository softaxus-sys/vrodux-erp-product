using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseReceipt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReceiptContentType",
                schema: "finance",
                table: "expenses",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "ReceiptData",
                schema: "finance",
                table: "expenses",
                type: "varbinary(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceiptFileName",
                schema: "finance",
                table: "expenses",
                type: "nvarchar(260)",
                maxLength: 260,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReceiptContentType",
                schema: "finance",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "ReceiptData",
                schema: "finance",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "ReceiptFileName",
                schema: "finance",
                table: "expenses");
        }
    }
}
