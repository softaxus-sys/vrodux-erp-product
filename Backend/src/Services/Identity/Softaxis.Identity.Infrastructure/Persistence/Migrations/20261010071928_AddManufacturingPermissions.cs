using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddManufacturingPermissions : Migration
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
                    { new Guid("1a3308e5-8d24-63bc-73df-e4305a3fbdd6"), "create", "Create manufacturing orders", "manufacturing.orders" },
                    { new Guid("1e57288d-3d6e-2351-9889-0aa4ed43c31d"), "delete", "Delete manufacturing boms", "manufacturing.boms" },
                    { new Guid("4518afaa-5be8-bf66-5493-af99ca7ef4a3"), "create", "Create manufacturing boms", "manufacturing.boms" },
                    { new Guid("5196562b-9acb-e4cc-87de-bba58258ffef"), "delete", "Delete manufacturing orders", "manufacturing.orders" },
                    { new Guid("558c25f7-f535-f69e-eed0-45f96176fd9a"), "view", "View manufacturing orders", "manufacturing.orders" },
                    { new Guid("c43a5cf1-d8dd-3bef-c390-439ff4166006"), "view", "View manufacturing boms", "manufacturing.boms" },
                    { new Guid("dc271bcc-e9f3-4a46-d94c-6d467ae7f2a0"), "edit", "Edit manufacturing boms", "manufacturing.boms" },
                    { new Guid("de166c0c-80e6-d9a3-af7c-14c85b5792b2"), "edit", "Edit manufacturing orders", "manufacturing.orders" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1a3308e5-8d24-63bc-73df-e4305a3fbdd6"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1e57288d-3d6e-2351-9889-0aa4ed43c31d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4518afaa-5be8-bf66-5493-af99ca7ef4a3"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("5196562b-9acb-e4cc-87de-bba58258ffef"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("558c25f7-f535-f69e-eed0-45f96176fd9a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c43a5cf1-d8dd-3bef-c390-439ff4166006"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("dc271bcc-e9f3-4a46-d94c-6d467ae7f2a0"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("de166c0c-80e6-d9a3-af7c-14c85b5792b2"));
        }
    }
}
