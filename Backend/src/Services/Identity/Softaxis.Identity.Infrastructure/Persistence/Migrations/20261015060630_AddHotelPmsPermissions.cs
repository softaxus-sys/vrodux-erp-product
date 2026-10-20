using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHotelPmsPermissions : Migration
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
                    { new Guid("049097f5-b55f-6ef1-aaf5-0a6bb3b53324"), "edit", "Edit hospitality rates", "hospitality.rates" },
                    { new Guid("21684cb0-90ad-bc95-a68b-bcfc31ecd76c"), "create", "Create hospitality rooms", "hospitality.rooms" },
                    { new Guid("4be00fdb-a78a-ed44-d023-32ad3acf726d"), "edit", "Edit hospitality settings", "hospitality.settings" },
                    { new Guid("4f159e2e-4462-646e-ff16-78d22f3ce9b4"), "view", "View hospitality rates", "hospitality.rates" },
                    { new Guid("65ca427c-d6b8-11b6-9d80-694f8cb6fe52"), "approve", "Approve hospitality folio", "hospitality.folio" },
                    { new Guid("6868f6d5-1108-7a03-40bf-6e8b5e5731d9"), "edit", "Edit hospitality guests", "hospitality.guests" },
                    { new Guid("7e6a372f-8c18-04fc-528c-9f7b48b1b234"), "create", "Create hospitality guests", "hospitality.guests" },
                    { new Guid("884d7e0c-b172-33bf-ec36-14f2c6dba54d"), "view", "View hospitality guests", "hospitality.guests" },
                    { new Guid("8d22786e-07c1-262c-9b9d-e6c41bfe4ff2"), "edit", "Edit hospitality rooms", "hospitality.rooms" },
                    { new Guid("9d64380b-6f46-5f9b-1f40-48c19ce5d8c4"), "view", "View hospitality folio", "hospitality.folio" },
                    { new Guid("9f32f8b9-f909-5601-5516-2a56b01cc615"), "create", "Create hospitality folio", "hospitality.folio" },
                    { new Guid("a8cbf0c1-0a71-a0c6-e2e6-f92e95b40799"), "delete", "Delete hospitality guests", "hospitality.guests" },
                    { new Guid("b63c6b76-019d-6175-5002-ba08fd4fc511"), "delete", "Delete hospitality rooms", "hospitality.rooms" },
                    { new Guid("ed1696d0-bd71-3399-5582-52028a078866"), "view", "View hospitality settings", "hospitality.settings" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("049097f5-b55f-6ef1-aaf5-0a6bb3b53324"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("21684cb0-90ad-bc95-a68b-bcfc31ecd76c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4be00fdb-a78a-ed44-d023-32ad3acf726d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4f159e2e-4462-646e-ff16-78d22f3ce9b4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("65ca427c-d6b8-11b6-9d80-694f8cb6fe52"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6868f6d5-1108-7a03-40bf-6e8b5e5731d9"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("7e6a372f-8c18-04fc-528c-9f7b48b1b234"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("884d7e0c-b172-33bf-ec36-14f2c6dba54d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("8d22786e-07c1-262c-9b9d-e6c41bfe4ff2"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9d64380b-6f46-5f9b-1f40-48c19ce5d8c4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9f32f8b9-f909-5601-5516-2a56b01cc615"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a8cbf0c1-0a71-a0c6-e2e6-f92e95b40799"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b63c6b76-019d-6175-5002-ba08fd4fc511"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ed1696d0-bd71-3399-5582-52028a078866"));
        }
    }
}
