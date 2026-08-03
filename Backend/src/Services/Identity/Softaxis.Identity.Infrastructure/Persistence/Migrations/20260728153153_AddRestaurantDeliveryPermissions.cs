using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantDeliveryPermissions : Migration
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
                    { new Guid("5f5b5167-3a1b-c4e4-8e02-7c416823f534"), "view", "View restaurant delivery", "restaurant.delivery" },
                    { new Guid("9f865719-bc52-0c15-2bff-50b7b45f7037"), "create", "Create restaurant delivery", "restaurant.delivery" },
                    { new Guid("e619aaf9-4c65-0577-b8e9-69934a254216"), "edit", "Edit restaurant delivery", "restaurant.delivery" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("5f5b5167-3a1b-c4e4-8e02-7c416823f534"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9f865719-bc52-0c15-2bff-50b7b45f7037"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e619aaf9-4c65-0577-b8e9-69934a254216"));
        }
    }
}
