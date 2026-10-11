using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceIntegrationPermissions : Migration
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
                    { new Guid("1e059c8c-62f8-3bcd-8278-88a2c065ad04"), "approve", "Approve finance integrations", "finance.integrations" },
                    { new Guid("583dbd60-fd3c-956e-283b-d4429dd2a268"), "edit", "Edit finance integrations", "finance.integrations" },
                    { new Guid("98549498-159e-f9bf-ccaa-84e7e872359e"), "view", "View finance integrations", "finance.integrations" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1e059c8c-62f8-3bcd-8278-88a2c065ad04"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("583dbd60-fd3c-956e-283b-d4429dd2a268"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("98549498-159e-f9bf-ccaa-84e7e872359e"));
        }
    }
}
