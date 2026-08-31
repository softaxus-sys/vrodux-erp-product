using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVoucherReceiptTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ReceiptSentAt",
                schema: "finance",
                table: "receipt_vouchers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceiptSentTo",
                schema: "finance",
                table: "receipt_vouchers",
                type: "nvarchar(320)",
                maxLength: 320,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReceiptSentAt",
                schema: "finance",
                table: "receipt_vouchers");

            migrationBuilder.DropColumn(
                name: "ReceiptSentTo",
                schema: "finance",
                table: "receipt_vouchers");
        }
    }
}
