using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceEInvoicingPermissions : Migration
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
                    { new Guid("187eb55e-deef-eb28-5aa9-88b7c6feb3aa"), "view", "View finance einvoicing", "finance.einvoicing" },
                    { new Guid("53ad24ee-22c1-4f77-6bc8-958f3cbb641b"), "send", "Send finance einvoicing", "finance.einvoicing" },
                    { new Guid("fe34317e-033e-e2b5-29d5-4547c674b87b"), "edit", "Edit finance einvoicing", "finance.einvoicing" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("187eb55e-deef-eb28-5aa9-88b7c6feb3aa"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("53ad24ee-22c1-4f77-6bc8-958f3cbb641b"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fe34317e-033e-e2b5-29d5-4547c674b87b"));
        }
    }
}
