using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.HR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHrTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "hr",
                table: "payroll_slips",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "hr",
                table: "payroll_runs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "hr",
                table: "leaves",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "hr",
                table: "employees",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "hr",
                table: "departments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "hr",
                table: "attendance_logs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_payroll_slips_TenantId",
                schema: "hr",
                table: "payroll_slips",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_runs_TenantId",
                schema: "hr",
                table: "payroll_runs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_leaves_TenantId",
                schema: "hr",
                table: "leaves",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_employees_TenantId",
                schema: "hr",
                table: "employees",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_departments_TenantId",
                schema: "hr",
                table: "departments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_logs_TenantId",
                schema: "hr",
                table: "attendance_logs",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_payroll_slips_TenantId",
                schema: "hr",
                table: "payroll_slips");

            migrationBuilder.DropIndex(
                name: "IX_payroll_runs_TenantId",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropIndex(
                name: "IX_leaves_TenantId",
                schema: "hr",
                table: "leaves");

            migrationBuilder.DropIndex(
                name: "IX_employees_TenantId",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_departments_TenantId",
                schema: "hr",
                table: "departments");

            migrationBuilder.DropIndex(
                name: "IX_attendance_logs_TenantId",
                schema: "hr",
                table: "attendance_logs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "hr",
                table: "payroll_slips");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "hr",
                table: "leaves");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "hr",
                table: "departments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "hr",
                table: "attendance_logs");
        }
    }
}
