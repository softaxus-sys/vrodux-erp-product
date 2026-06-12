using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddJournalEntryLinkToSubledgers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "JournalEntryId",
                schema: "finance",
                table: "receipt_vouchers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "JournalEntryId",
                schema: "finance",
                table: "purchase_bills",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "JournalEntryId",
                schema: "finance",
                table: "payment_vouchers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "JournalEntryId",
                schema: "finance",
                table: "invoices",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "JournalEntryId",
                schema: "finance",
                table: "expenses",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "JournalEntryId",
                schema: "finance",
                table: "receipt_vouchers");

            migrationBuilder.DropColumn(
                name: "JournalEntryId",
                schema: "finance",
                table: "purchase_bills");

            migrationBuilder.DropColumn(
                name: "JournalEntryId",
                schema: "finance",
                table: "payment_vouchers");

            migrationBuilder.DropColumn(
                name: "JournalEntryId",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "JournalEntryId",
                schema: "finance",
                table: "expenses");
        }
    }
}
