using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantTaxAndPlatformPermissions : Migration
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
                    { new Guid("36c562de-5ae0-705d-fb07-c6222859d4dd"), "edit", "Edit restaurant tax", "restaurant.tax" },
                    { new Guid("69799f4b-66b6-7427-2935-e1f7894dfbc3"), "view", "View restaurant integrations", "restaurant.integrations" },
                    { new Guid("8169e5d7-d4df-09e9-d64f-fe4e180e8808"), "view", "View restaurant tax", "restaurant.tax" },
                    { new Guid("8efcebea-abb9-6ffe-5a82-f4c0c7a509cd"), "edit", "Edit restaurant integrations", "restaurant.integrations" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("36c562de-5ae0-705d-fb07-c6222859d4dd"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("69799f4b-66b6-7427-2935-e1f7894dfbc3"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("8169e5d7-d4df-09e9-d64f-fe4e180e8808"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("8efcebea-abb9-6ffe-5a82-f4c0c7a509cd"));
        }
    }
}
