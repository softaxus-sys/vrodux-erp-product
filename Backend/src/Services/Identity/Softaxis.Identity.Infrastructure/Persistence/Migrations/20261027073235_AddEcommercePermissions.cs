using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEcommercePermissions : Migration
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
                    { new Guid("067a383e-25ab-8eed-484f-63ffb53c25b9"), "delete", "Delete ecommerce channels", "ecommerce.channels" },
                    { new Guid("09ada7ad-1fc4-3722-b5d1-0e87628b8604"), "create", "Create ecommerce channels", "ecommerce.channels" },
                    { new Guid("0fb21706-01a9-7b95-74c4-eb65c2712501"), "delete", "Delete ecommerce listings", "ecommerce.listings" },
                    { new Guid("55c33077-d1dd-d6d8-69b7-4ca1715ca4b4"), "create", "Create ecommerce listings", "ecommerce.listings" },
                    { new Guid("831ddd15-8126-8d75-49e3-3b5ff5d56619"), "edit", "Edit ecommerce channels", "ecommerce.channels" },
                    { new Guid("93f9e367-0202-104f-6fd1-e97410c89dac"), "view", "View ecommerce listings", "ecommerce.listings" },
                    { new Guid("991aefbe-28a1-5809-aea6-f743436632bd"), "edit", "Edit ecommerce listings", "ecommerce.listings" },
                    { new Guid("9b0601d7-8537-99a4-4000-b89918b3a156"), "view", "View ecommerce orders", "ecommerce.orders" },
                    { new Guid("b366272c-5bb4-19ad-c5cb-3a50284117f0"), "view", "View ecommerce channels", "ecommerce.channels" },
                    { new Guid("c33b07d4-a2dd-8221-02dc-d482bd73c195"), "edit", "Edit ecommerce orders", "ecommerce.orders" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("067a383e-25ab-8eed-484f-63ffb53c25b9"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("09ada7ad-1fc4-3722-b5d1-0e87628b8604"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("0fb21706-01a9-7b95-74c4-eb65c2712501"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("55c33077-d1dd-d6d8-69b7-4ca1715ca4b4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("831ddd15-8126-8d75-49e3-3b5ff5d56619"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("93f9e367-0202-104f-6fd1-e97410c89dac"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("991aefbe-28a1-5809-aea6-f743436632bd"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9b0601d7-8537-99a4-4000-b89918b3a156"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b366272c-5bb4-19ad-c5cb-3a50284117f0"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c33b07d4-a2dd-8221-02dc-d482bd73c195"));
        }
    }
}
