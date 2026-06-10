using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.HR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollRejectionAndCreator : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedByName",
                schema: "hr",
                table: "payroll_runs",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserId",
                schema: "hr",
                table: "payroll_runs",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedAt",
                schema: "hr",
                table: "payroll_runs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectedByName",
                schema: "hr",
                table: "payroll_runs",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                schema: "hr",
                table: "payroll_runs",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedByName",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "RejectedAt",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "RejectedByName",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                schema: "hr",
                table: "payroll_runs");
        }
    }
}
