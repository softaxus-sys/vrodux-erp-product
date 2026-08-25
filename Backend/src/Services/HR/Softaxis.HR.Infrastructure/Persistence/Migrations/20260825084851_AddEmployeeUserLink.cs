using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.HR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeUserLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                schema: "hr",
                table: "employees",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_employees_TenantId_UserId",
                schema: "hr",
                table: "employees",
                columns: new[] { "TenantId", "UserId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [UserId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_employees_TenantId_UserId",
                schema: "hr",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "UserId",
                schema: "hr",
                table: "employees");
        }
    }
}
