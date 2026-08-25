using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHrSelfServicePermissions : Migration
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
                    { new Guid("0ca08c0d-13d0-3237-70af-c564253a70fa"), "attendance", "Attendance hr self", "hr.self" },
                    { new Guid("1e8cade4-b534-60b3-ac45-e7b01370bb52"), "payslip", "Payslip hr self", "hr.self" },
                    { new Guid("539f4396-9246-70db-c08c-3d757f3d5ca7"), "leave-request", "Leave-request hr self", "hr.self" },
                    { new Guid("9decbd74-633e-bfed-e623-9a3d7df0d1b2"), "view", "View hr self", "hr.self" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("0ca08c0d-13d0-3237-70af-c564253a70fa"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1e8cade4-b534-60b3-ac45-e7b01370bb52"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("539f4396-9246-70db-c08c-3d757f3d5ca7"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9decbd74-633e-bfed-e623-9a3d7df0d1b2"));
        }
    }
}
