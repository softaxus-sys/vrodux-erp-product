using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantPermissions : Migration
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
                    { new Guid("06195456-c1bb-c9c5-c218-9e74430c2cd3"), "void", "Void restaurant orders", "restaurant.orders" },
                    { new Guid("06f08e3c-8d57-3b43-85cf-c665489ccb68"), "view", "View restaurant kitchen", "restaurant.kitchen" },
                    { new Guid("1449b05a-d916-acb9-63db-c6843e7f522e"), "edit", "Edit restaurant orders", "restaurant.orders" },
                    { new Guid("2417677f-efdb-cbed-d772-99a2fac2bc70"), "edit", "Edit restaurant tables", "restaurant.tables" },
                    { new Guid("2befd0d5-688e-070e-0d54-b7da282bbeb4"), "create", "Create restaurant orders", "restaurant.orders" },
                    { new Guid("2c41cef5-69fa-143c-a112-324cbc3a5565"), "view", "View restaurant menu", "restaurant.menu" },
                    { new Guid("465fc5ee-f624-2022-1000-7aa947a41bb7"), "view", "View restaurant reservations", "restaurant.reservations" },
                    { new Guid("4a41c354-98e8-6167-52dd-12d32c86c039"), "create", "Create restaurant reservations", "restaurant.reservations" },
                    { new Guid("5058bc29-615f-2b56-dacc-e7442f2794bd"), "discount", "Discount restaurant orders", "restaurant.orders" },
                    { new Guid("5957c8ea-fa22-796d-7bbd-1ef8f7ec6bbc"), "create", "Create restaurant menu", "restaurant.menu" },
                    { new Guid("6dd8ec78-0137-d5cd-ed4c-6392fbfa8c67"), "edit", "Edit restaurant menu", "restaurant.menu" },
                    { new Guid("9afec136-555a-08fd-9434-0f0d0fab0220"), "refund", "Refund restaurant orders", "restaurant.orders" },
                    { new Guid("ce2b0111-933f-1511-dd3f-0a1d7314b787"), "edit", "Edit restaurant kitchen", "restaurant.kitchen" },
                    { new Guid("d5296adb-c36a-b6cf-fe22-67d3f9abd4cc"), "edit", "Edit restaurant reservations", "restaurant.reservations" },
                    { new Guid("e1390ca8-7813-1142-d690-49f61daca567"), "view", "View restaurant orders", "restaurant.orders" },
                    { new Guid("e6f98464-a947-48ed-e557-f298ae071e6f"), "create", "Create restaurant tables", "restaurant.tables" },
                    { new Guid("fa120075-a9f0-830d-d1d6-d7cb86ed4add"), "view", "View restaurant tables", "restaurant.tables" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("06195456-c1bb-c9c5-c218-9e74430c2cd3"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("06f08e3c-8d57-3b43-85cf-c665489ccb68"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1449b05a-d916-acb9-63db-c6843e7f522e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2417677f-efdb-cbed-d772-99a2fac2bc70"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2befd0d5-688e-070e-0d54-b7da282bbeb4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2c41cef5-69fa-143c-a112-324cbc3a5565"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("465fc5ee-f624-2022-1000-7aa947a41bb7"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4a41c354-98e8-6167-52dd-12d32c86c039"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("5058bc29-615f-2b56-dacc-e7442f2794bd"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("5957c8ea-fa22-796d-7bbd-1ef8f7ec6bbc"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6dd8ec78-0137-d5cd-ed4c-6392fbfa8c67"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("9afec136-555a-08fd-9434-0f0d0fab0220"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ce2b0111-933f-1511-dd3f-0a1d7314b787"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("d5296adb-c36a-b6cf-fe22-67d3f9abd4cc"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e1390ca8-7813-1142-d690-49f61daca567"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e6f98464-a947-48ed-e557-f298ae071e6f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fa120075-a9f0-830d-d1d6-d7cb86ed4add"));
        }
    }
}
