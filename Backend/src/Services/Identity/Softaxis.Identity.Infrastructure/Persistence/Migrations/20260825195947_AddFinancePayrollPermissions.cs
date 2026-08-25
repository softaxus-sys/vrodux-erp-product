using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancePayrollPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "identity",
                table: "permissions",
                columns: new[] { "Id", "Action", "Description", "ModuleId" },
                values: new object[,]
                {
                    { new Guid("4ef1ecd2-a04e-4cbc-7d19-6c731ee9bf5e"), "view", "View finance payroll", "finance.payroll" },
                    { new Guid("9f7186a4-eaed-0f4a-c85b-e974d2c549f2"), "approve", "Approve finance payroll", "finance.payroll" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4ef1ecd2-a04e-4cbc-7d19-6c731ee9bf5e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9f7186a4-eaed-0f4a-c85b-e974d2c549f2"));
        }
    }
}
