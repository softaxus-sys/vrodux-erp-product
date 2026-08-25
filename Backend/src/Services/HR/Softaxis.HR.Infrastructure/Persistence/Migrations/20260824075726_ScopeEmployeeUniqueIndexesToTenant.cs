using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.HR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeEmployeeUniqueIndexesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_employees_Email",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_employees_EmployeeNumber",
                schema: "hr",
                table: "employees");

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_employees_TenantId_Email",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_employees_TenantId_EmployeeNumber",
                schema: "hr",
                table: "employees");

            migrationBuilder.CreateIndex(
                name: "IX_employees_Email",
                schema: "hr",
                table: "employees",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_employees_EmployeeNumber",
                schema: "hr",
                table: "employees",
                column: "EmployeeNumber",
                unique: true);
        }
    }
}
