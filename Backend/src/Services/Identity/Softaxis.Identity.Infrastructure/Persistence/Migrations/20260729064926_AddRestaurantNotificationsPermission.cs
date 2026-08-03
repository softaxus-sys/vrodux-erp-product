using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantNotificationsPermission : Migration
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
                    { new Guid("aa2b13ee-0893-d0ef-29dc-ebf30171b19e"), "view", "View restaurant notifications", "restaurant.notifications" },
                    { new Guid("fcc40c3f-2eb8-34ba-8035-8bcd8553c840"), "edit", "Edit restaurant notifications", "restaurant.notifications" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("aa2b13ee-0893-d0ef-29dc-ebf30171b19e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fcc40c3f-2eb8-34ba-8035-8bcd8553c840"));
        }
    }
}
