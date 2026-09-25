using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSeoContentPermission : Migration
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
                    { new Guid("7a63d4a8-8ba4-8ec8-c90e-d5e67a9e27e0"), "edit", "Edit seo content", "seo.content" },
                    { new Guid("d4662176-9d5e-fd8c-2d14-a4876b68bdd4"), "view", "View seo content", "seo.content" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("7a63d4a8-8ba4-8ec8-c90e-d5e67a9e27e0"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("d4662176-9d5e-fd8c-2d14-a4876b68bdd4"));
        }
    }
}
