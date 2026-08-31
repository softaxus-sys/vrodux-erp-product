using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRecurringInvoiceEmailing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutoSend",
                schema: "finance",
                table: "recurring_invoices",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "CcEmails",
                schema: "finance",
                table: "recurring_invoices",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailCc",
                schema: "finance",
                table: "invoices",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EmailSentAt",
                schema: "finance",
                table: "invoices",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailSentTo",
                schema: "finance",
                table: "invoices",
                type: "nvarchar(320)",
                maxLength: 320,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutoSend",
                schema: "finance",
                table: "recurring_invoices");

            migrationBuilder.DropColumn(
                name: "CcEmails",
                schema: "finance",
                table: "recurring_invoices");

            migrationBuilder.DropColumn(
                name: "EmailCc",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "EmailSentAt",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "EmailSentTo",
                schema: "finance",
                table: "invoices");
        }
    }
}
