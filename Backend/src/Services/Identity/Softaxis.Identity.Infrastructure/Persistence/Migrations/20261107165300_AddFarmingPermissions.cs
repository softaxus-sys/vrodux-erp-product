using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFarmingPermissions : Migration
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
                    { new Guid("1762eca5-27f3-ca6f-ecb7-4b1c7ba858cc"), "view", "View farming reports", "farming.reports" },
                    { new Guid("194de3b7-15a6-d722-5c24-7a4baf4a6404"), "delete", "Delete farming livestock", "farming.livestock" },
                    { new Guid("259b44ec-6ad3-f959-7d58-9721140e0b78"), "create", "Create farming sales", "farming.sales" },
                    { new Guid("284fe9e7-79e5-3ef2-5838-e82233b7aae3"), "edit", "Edit farming setup", "farming.setup" },
                    { new Guid("35560930-f140-c166-4d70-677d10725bff"), "delete", "Delete farming production", "farming.production" },
                    { new Guid("3d476236-d170-b8e5-9e64-a0a2aad9b26f"), "view", "View farming setup", "farming.setup" },
                    { new Guid("52fcae02-a5aa-56aa-c283-bbf0a8d198a0"), "delete", "Delete farming health", "farming.health" },
                    { new Guid("5a50b76b-f2c8-4d32-feef-4f2bd51b6680"), "edit", "Edit farming sales", "farming.sales" },
                    { new Guid("6ad2ba2f-6302-1127-db12-660cf0ec6475"), "view", "View farming health", "farming.health" },
                    { new Guid("90d3f325-f66e-42c8-4da8-a2cd947dfc1f"), "create", "Create farming health", "farming.health" },
                    { new Guid("ac54894f-f71e-c6a9-e660-e22d09f80d51"), "view", "View farming sales", "farming.sales" },
                    { new Guid("c6984670-be3c-a321-b7ea-a4ff746594fa"), "delete", "Delete farming sales", "farming.sales" },
                    { new Guid("ca38cdd3-0387-b736-d31a-05aead55f7bf"), "edit", "Edit farming livestock", "farming.livestock" },
                    { new Guid("ca9f9f7d-c85a-6dc7-997d-8002d83c3147"), "edit", "Edit farming production", "farming.production" },
                    { new Guid("da6e82cd-334b-659c-2180-43091c029dde"), "view", "View farming production", "farming.production" },
                    { new Guid("e1e60d41-1f4c-cf00-67b4-9f2bd2cdf558"), "view", "View farming livestock", "farming.livestock" },
                    { new Guid("e4b8c87c-fa8f-a3a0-41a5-bb4a777275a9"), "create", "Create farming production", "farming.production" },
                    { new Guid("eb4014d2-1bd2-07ab-1aa4-268576491af6"), "create", "Create farming livestock", "farming.livestock" },
                    { new Guid("f1b4bf65-8930-879b-f2f1-298b5bcd1f38"), "edit", "Edit farming health", "farming.health" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1762eca5-27f3-ca6f-ecb7-4b1c7ba858cc"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("194de3b7-15a6-d722-5c24-7a4baf4a6404"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("259b44ec-6ad3-f959-7d58-9721140e0b78"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("284fe9e7-79e5-3ef2-5838-e82233b7aae3"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("35560930-f140-c166-4d70-677d10725bff"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3d476236-d170-b8e5-9e64-a0a2aad9b26f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("52fcae02-a5aa-56aa-c283-bbf0a8d198a0"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("5a50b76b-f2c8-4d32-feef-4f2bd51b6680"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6ad2ba2f-6302-1127-db12-660cf0ec6475"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("90d3f325-f66e-42c8-4da8-a2cd947dfc1f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ac54894f-f71e-c6a9-e660-e22d09f80d51"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c6984670-be3c-a321-b7ea-a4ff746594fa"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ca38cdd3-0387-b736-d31a-05aead55f7bf"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ca9f9f7d-c85a-6dc7-997d-8002d83c3147"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("da6e82cd-334b-659c-2180-43091c029dde"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e1e60d41-1f4c-cf00-67b4-9f2bd2cdf558"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e4b8c87c-fa8f-a3a0-41a5-bb4a777275a9"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("eb4014d2-1bd2-07ab-1aa4-268576491af6"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f1b4bf65-8930-879b-f2f1-298b5bcd1f38"));
        }
    }
}
