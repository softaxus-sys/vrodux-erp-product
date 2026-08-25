using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.HR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollFinanceApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FinanceApprovedAt",
                schema: "hr",
                table: "payroll_runs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinanceApprovedByName",
                schema: "hr",
                table: "payroll_runs",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "JournalEntryId",
                schema: "hr",
                table: "payroll_runs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JournalEntryNumber",
                schema: "hr",
                table: "payroll_runs",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FinanceApprovedAt",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "FinanceApprovedByName",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "JournalEntryId",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "JournalEntryNumber",
                schema: "hr",
                table: "payroll_runs");
        }
    }
}
