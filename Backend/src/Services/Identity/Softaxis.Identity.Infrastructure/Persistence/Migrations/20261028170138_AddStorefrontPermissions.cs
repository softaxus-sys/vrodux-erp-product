using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStorefrontPermissions : Migration
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
                    { new Guid("27bd7f51-8dd3-7897-5ec3-0b828b89aa7c"), "view", "View ecommerce discounts", "ecommerce.discounts" },
                    { new Guid("7b973349-8937-e6b0-5880-5ec57cf010e4"), "delete", "Delete ecommerce discounts", "ecommerce.discounts" },
                    { new Guid("7b9d4da8-6f3d-472e-d375-a3b4bc78b87d"), "edit", "Edit ecommerce discounts", "ecommerce.discounts" },
                    { new Guid("b64f0a1e-e831-78e0-b67c-dbe05b55d8c1"), "create", "Create ecommerce discounts", "ecommerce.discounts" },
                    { new Guid("c347f5b2-6817-798c-d24a-d234779def4c"), "refund", "Refund ecommerce orders", "ecommerce.orders" },
                    { new Guid("c7ab99a7-6291-1cda-e766-bab2aaa0c6f6"), "edit", "Edit ecommerce store", "ecommerce.store" },
                    { new Guid("dd524030-e1de-f782-666c-170b853c4b3f"), "view", "View ecommerce store", "ecommerce.store" },
                    { new Guid("eb42d0f3-9e02-93bb-a56b-9ab7eab056b0"), "view", "View ecommerce customers", "ecommerce.customers" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("27bd7f51-8dd3-7897-5ec3-0b828b89aa7c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("7b973349-8937-e6b0-5880-5ec57cf010e4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("7b9d4da8-6f3d-472e-d375-a3b4bc78b87d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b64f0a1e-e831-78e0-b67c-dbe05b55d8c1"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c347f5b2-6817-798c-d24a-d234779def4c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c7ab99a7-6291-1cda-e766-bab2aaa0c6f6"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("dd524030-e1de-f782-666c-170b853c4b3f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("eb42d0f3-9e02-93bb-a56b-9ab7eab056b0"));
        }
    }
}
