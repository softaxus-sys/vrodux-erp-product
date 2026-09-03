using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceScheduleAndReminders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LastReminderDaysBefore",
                schema: "finance",
                table: "invoices",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastReminderSentAt",
                schema: "finance",
                table: "invoices",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RemindBeforeDue",
                schema: "finance",
                table: "invoices",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "ScheduledSendDate",
                schema: "finance",
                table: "invoices",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_invoices_ScheduledSendDate",
                schema: "finance",
                table: "invoices",
                column: "ScheduledSendDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_invoices_ScheduledSendDate",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "LastReminderDaysBefore",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "LastReminderSentAt",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "RemindBeforeDue",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "ScheduledSendDate",
                schema: "finance",
                table: "invoices");
        }
    }
}
