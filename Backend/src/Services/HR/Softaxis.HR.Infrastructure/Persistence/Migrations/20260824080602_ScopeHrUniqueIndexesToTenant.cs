using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.HR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeHrUniqueIndexesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_payroll_runs_RunNumber",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropIndex(
                name: "IX_leaves_LeaveNumber",
                schema: "hr",
                table: "leaves");

            migrationBuilder.DropIndex(
                name: "IX_employees_TenantId_Email",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_employees_TenantId_EmployeeNumber",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_departments_Code",
                schema: "hr",
                table: "departments");

            migrationBuilder.DropIndex(
                name: "IX_departments_Name",
                schema: "hr",
                table: "departments");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_runs_TenantId_RunNumber",
                schema: "hr",
                table: "payroll_runs",
                columns: new[] { "TenantId", "RunNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_leaves_TenantId_LeaveNumber",
                schema: "hr",
                table: "leaves",
                columns: new[] { "TenantId", "LeaveNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_employees_TenantId_Email",
                schema: "hr",
                table: "employees",
                columns: new[] { "TenantId", "Email" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_employees_TenantId_EmployeeNumber",
                schema: "hr",
                table: "employees",
                columns: new[] { "TenantId", "EmployeeNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_departments_TenantId_Code",
                schema: "hr",
                table: "departments",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_departments_TenantId_Name",
                schema: "hr",
                table: "departments",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_payroll_runs_TenantId_RunNumber",
                schema: "hr",
                table: "payroll_runs");

            migrationBuilder.DropIndex(
                name: "IX_leaves_TenantId_LeaveNumber",
                schema: "hr",
                table: "leaves");

            migrationBuilder.DropIndex(
                name: "IX_employees_TenantId_Email",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_employees_TenantId_EmployeeNumber",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_departments_TenantId_Code",
                schema: "hr",
                table: "departments");

            migrationBuilder.DropIndex(
                name: "IX_departments_TenantId_Name",
                schema: "hr",
                table: "departments");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_runs_RunNumber",
                schema: "hr",
                table: "payroll_runs",
                column: "RunNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_leaves_LeaveNumber",
                schema: "hr",
                table: "leaves",
                column: "LeaveNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_employees_TenantId_Email",
                schema: "hr",
                table: "employees",
                columns: new[] { "TenantId", "Email" },
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_employees_TenantId_EmployeeNumber",
                schema: "hr",
                table: "employees",
                columns: new[] { "TenantId", "EmployeeNumber" },
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_departments_Code",
                schema: "hr",
                table: "departments",
                column: "Code",
                unique: true,
                filter: "[Code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_departments_Name",
                schema: "hr",
                table: "departments",
                column: "Name",
                unique: true);
        }
    }
}
