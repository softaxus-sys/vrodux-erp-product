using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTradePermissions : Migration
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
                    { new Guid("0ef909e5-7be9-671f-112f-64d8fddd094c"), "view", "View trade parties", "trade.parties" },
                    { new Guid("22db9567-d7df-dacf-e95a-5d231bb67bdc"), "view", "View trade shipments", "trade.shipments" },
                    { new Guid("3bc6f938-3cdd-5041-87ba-0d4f12532788"), "view", "View trade documents", "trade.documents" },
                    { new Guid("424f302d-cd2c-9f3f-48b3-b397f09f7595"), "edit", "Edit trade documents", "trade.documents" },
                    { new Guid("4fa57969-c2bd-1c71-98aa-f459557b154d"), "edit", "Edit trade shipments", "trade.shipments" },
                    { new Guid("522e230a-981a-496c-f17e-656850c33edd"), "edit", "Edit trade costs", "trade.costs" },
                    { new Guid("54424c9a-fdcb-3317-ea87-c076572f9038"), "create", "Create trade shipments", "trade.shipments" },
                    { new Guid("614dddd3-0c7c-34ec-f1be-f3fc61ed8887"), "create", "Create trade payments", "trade.payments" },
                    { new Guid("6c3861d7-6e69-b24a-51be-f3a831b3e653"), "view", "View trade payments", "trade.payments" },
                    { new Guid("6c3f40cb-f41c-6a49-1aff-d89cbc536a28"), "create", "Create trade documents", "trade.documents" },
                    { new Guid("87f98c49-fac6-1bb5-c130-3bc46a97cecc"), "create", "Create trade parties", "trade.parties" },
                    { new Guid("a2fbecf3-4163-702e-c9c3-a084f157dac3"), "delete", "Delete trade documents", "trade.documents" },
                    { new Guid("ad8536c0-906a-b08a-4644-ed01df6ec7f5"), "delete", "Delete trade costs", "trade.costs" },
                    { new Guid("afec20ba-672b-2499-37ca-e11abf7cf423"), "view", "View trade costs", "trade.costs" },
                    { new Guid("cffc8ff8-704f-dbd6-bf89-8ef4656ec056"), "edit", "Edit trade payments", "trade.payments" },
                    { new Guid("e86a898d-d452-f055-aa44-7fe6346d0e4b"), "edit", "Edit trade parties", "trade.parties" },
                    { new Guid("ee991263-e44b-d666-3b04-f709a25358c1"), "create", "Create trade costs", "trade.costs" },
                    { new Guid("ef171d42-3b98-db02-e26b-513e6d08d0f4"), "delete", "Delete trade parties", "trade.parties" },
                    { new Guid("fa350e58-6a22-ef38-e0ce-bb2c77b9f588"), "delete", "Delete trade shipments", "trade.shipments" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("0ef909e5-7be9-671f-112f-64d8fddd094c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("22db9567-d7df-dacf-e95a-5d231bb67bdc"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3bc6f938-3cdd-5041-87ba-0d4f12532788"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("424f302d-cd2c-9f3f-48b3-b397f09f7595"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4fa57969-c2bd-1c71-98aa-f459557b154d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("522e230a-981a-496c-f17e-656850c33edd"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("54424c9a-fdcb-3317-ea87-c076572f9038"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("614dddd3-0c7c-34ec-f1be-f3fc61ed8887"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6c3861d7-6e69-b24a-51be-f3a831b3e653"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6c3f40cb-f41c-6a49-1aff-d89cbc536a28"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("87f98c49-fac6-1bb5-c130-3bc46a97cecc"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a2fbecf3-4163-702e-c9c3-a084f157dac3"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ad8536c0-906a-b08a-4644-ed01df6ec7f5"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("afec20ba-672b-2499-37ca-e11abf7cf423"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("cffc8ff8-704f-dbd6-bf89-8ef4656ec056"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e86a898d-d452-f055-aa44-7fe6346d0e4b"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ee991263-e44b-d666-3b04-f709a25358c1"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ef171d42-3b98-db02-e26b-513e6d08d0f4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fa350e58-6a22-ef38-e0ce-bb2c77b9f588"));
        }
    }
}
