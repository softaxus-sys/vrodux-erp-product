using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVisaPermissions : Migration
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
                    { new Guid("1e980908-a979-13af-3c41-59aa7186d2c9"), "create", "Create visa cases", "visa.cases" },
                    { new Guid("28bc23f0-b0af-4648-39b8-49213bcfd5ac"), "view", "View visa cases", "visa.cases" },
                    { new Guid("55365c3b-ff8d-f382-156b-1c435df7a6ea"), "delete", "Delete visa cases", "visa.cases" },
                    { new Guid("eeec71e0-3f6a-c3e2-ca26-01f6339c3669"), "edit", "Edit visa cases", "visa.cases" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1e980908-a979-13af-3c41-59aa7186d2c9"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("28bc23f0-b0af-4648-39b8-49213bcfd5ac"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("55365c3b-ff8d-f382-156b-1c435df7a6ea"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("eeec71e0-3f6a-c3e2-ca26-01f6339c3669"));
        }
    }
}
