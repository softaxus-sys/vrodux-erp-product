using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancePostingLevelPermissions : Migration
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
                    { new Guid("85d5e99c-5052-2a21-3130-1a6ecad820c6"), "approve-high", "Approve-high finance integrations", "finance.integrations" },
                    { new Guid("aa801c5a-7ded-fe4b-eee2-34c0244d6cb0"), "submit", "Submit finance integrations", "finance.integrations" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("85d5e99c-5052-2a21-3130-1a6ecad820c6"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("aa801c5a-7ded-fe4b-eee2-34c0244d6cb0"));
        }
    }
}
