using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantDevicesPermission : Migration
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
                    { new Guid("b3bb7a1b-736a-1eea-9ada-5fde8768902a"), "view", "View restaurant devices", "restaurant.devices" },
                    { new Guid("fd29da84-4cac-e905-7523-c6cc96bdc6a7"), "edit", "Edit restaurant devices", "restaurant.devices" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b3bb7a1b-736a-1eea-9ada-5fde8768902a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fd29da84-4cac-e905-7523-c6cc96bdc6a7"));
        }
    }
}
