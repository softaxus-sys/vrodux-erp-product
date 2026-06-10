using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.HR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollSlipEmailTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EmailSentAt",
                schema: "hr",
                table: "payroll_slips",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailSentTo",
                schema: "hr",
                table: "payroll_slips",
                type: "nvarchar(320)",
                maxLength: 320,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailSentAt",
                schema: "hr",
                table: "payroll_slips");

            migrationBuilder.DropColumn(
                name: "EmailSentTo",
                schema: "hr",
                table: "payroll_slips");
        }
    }
}
