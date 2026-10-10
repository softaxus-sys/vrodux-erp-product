using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryPermissions : Migration
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
                    { new Guid("35add296-c6f0-900a-1647-1226bc29ea46"), "view", "View library fines", "library.fines" },
                    { new Guid("4124274b-23f5-7e3d-ca87-922c0598531d"), "edit", "Edit library fines", "library.fines" },
                    { new Guid("4242ea25-61c4-738f-f63a-ccec7bce061e"), "edit", "Edit library members", "library.members" },
                    { new Guid("5154338a-9ddd-9aac-a93a-62e14ce4f502"), "approve", "Approve library fines", "library.fines" },
                    { new Guid("63898d84-d829-ba20-8f23-3d5201ddfa1d"), "view", "View library setup", "library.setup" },
                    { new Guid("6e2f0275-2dbf-bbb0-e5f2-b43d10dc9314"), "create", "Create library members", "library.members" },
                    { new Guid("711ed266-2b4d-08e1-061f-868fd140656c"), "create", "Create library circulation", "library.circulation" },
                    { new Guid("8f5ab2a7-d9b6-9cac-4922-02c1ce56b551"), "create", "Create library fines", "library.fines" },
                    { new Guid("a900d05e-9e1e-04bf-ce1c-cb857eb39cb6"), "delete", "Delete library catalog", "library.catalog" },
                    { new Guid("ae21fe2b-f154-df31-af10-c9d32f58f435"), "edit", "Edit library catalog", "library.catalog" },
                    { new Guid("b0932dfd-bd71-883a-f5f6-ab196ac84fab"), "create", "Create library catalog", "library.catalog" },
                    { new Guid("bd829283-d3fa-1cb8-fc92-4c59757d826a"), "view", "View library circulation", "library.circulation" },
                    { new Guid("d6df99aa-334b-5fef-f5dc-8449209e6800"), "edit", "Edit library circulation", "library.circulation" },
                    { new Guid("da48e6af-655f-cc00-fd3c-772511ff6dbf"), "edit", "Edit library setup", "library.setup" },
                    { new Guid("e8879168-1962-2e40-3244-9a1917588a1a"), "view", "View library catalog", "library.catalog" },
                    { new Guid("f2def96d-37db-ff02-0882-7a96eed2dce8"), "view", "View library members", "library.members" },
                    { new Guid("f6cd37d7-f62c-bcfd-2698-0b82f9daa58b"), "delete", "Delete library members", "library.members" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("35add296-c6f0-900a-1647-1226bc29ea46"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4124274b-23f5-7e3d-ca87-922c0598531d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4242ea25-61c4-738f-f63a-ccec7bce061e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("5154338a-9ddd-9aac-a93a-62e14ce4f502"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("63898d84-d829-ba20-8f23-3d5201ddfa1d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6e2f0275-2dbf-bbb0-e5f2-b43d10dc9314"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("711ed266-2b4d-08e1-061f-868fd140656c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("8f5ab2a7-d9b6-9cac-4922-02c1ce56b551"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a900d05e-9e1e-04bf-ce1c-cb857eb39cb6"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ae21fe2b-f154-df31-af10-c9d32f58f435"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b0932dfd-bd71-883a-f5f6-ab196ac84fab"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("bd829283-d3fa-1cb8-fc92-4c59757d826a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("d6df99aa-334b-5fef-f5dc-8449209e6800"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("da48e6af-655f-cc00-fd3c-772511ff6dbf"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e8879168-1962-2e40-3244-9a1917588a1a"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f2def96d-37db-ff02-0882-7a96eed2dce8"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f6cd37d7-f62c-bcfd-2698-0b82f9daa58b"));
        }
    }
}
