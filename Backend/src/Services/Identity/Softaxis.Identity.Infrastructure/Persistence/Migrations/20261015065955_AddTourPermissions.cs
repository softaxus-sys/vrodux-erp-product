using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTourPermissions : Migration
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
                    { new Guid("04d131bd-a386-92e2-26bf-6b55c10cadd5"), "create", "Create hospitality tour-bookings", "hospitality.tour-bookings" },
                    { new Guid("184f6690-2ab9-b7ab-28f0-66db4d534363"), "edit", "Edit hospitality tour-costs", "hospitality.tour-costs" },
                    { new Guid("1966a19c-f5af-06ce-7789-6aaa3a45f508"), "delete", "Delete hospitality tour-bookings", "hospitality.tour-bookings" },
                    { new Guid("5c8fb9f0-5501-4ff1-0355-b374a48fb00d"), "edit", "Edit hospitality tours", "hospitality.tours" },
                    { new Guid("6c1bb489-43e7-1baa-2b0a-41991a0b7800"), "create", "Create hospitality tours", "hospitality.tours" },
                    { new Guid("75f9ca1f-aaa2-a494-77ec-7088ed29ca85"), "record", "Record hospitality tour-bookings", "hospitality.tour-bookings" },
                    { new Guid("aa614ffb-bb9b-9df0-fc0e-65474b02f06d"), "delete", "Delete hospitality tours", "hospitality.tours" },
                    { new Guid("b46ec677-6f62-4036-fcb7-7057781256b4"), "view", "View hospitality tour-bookings", "hospitality.tour-bookings" },
                    { new Guid("caba3aac-e40d-9ea6-8571-7be79e0aefbc"), "view", "View hospitality tour-costs", "hospitality.tour-costs" },
                    { new Guid("cef02e35-e5d1-4600-41e8-14163027304c"), "view", "View hospitality tours", "hospitality.tours" },
                    { new Guid("e3885b80-774b-5de8-1baa-c15c947e2417"), "void", "Void hospitality tour-bookings", "hospitality.tour-bookings" },
                    { new Guid("f9e4cdf4-44ab-387a-183b-c5f820d6d65e"), "edit", "Edit hospitality tour-bookings", "hospitality.tour-bookings" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("04d131bd-a386-92e2-26bf-6b55c10cadd5"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("184f6690-2ab9-b7ab-28f0-66db4d534363"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1966a19c-f5af-06ce-7789-6aaa3a45f508"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("5c8fb9f0-5501-4ff1-0355-b374a48fb00d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6c1bb489-43e7-1baa-2b0a-41991a0b7800"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("75f9ca1f-aaa2-a494-77ec-7088ed29ca85"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("aa614ffb-bb9b-9df0-fc0e-65474b02f06d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b46ec677-6f62-4036-fcb7-7057781256b4"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("caba3aac-e40d-9ea6-8571-7be79e0aefbc"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("cef02e35-e5d1-4600-41e8-14163027304c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e3885b80-774b-5de8-1baa-c15c947e2417"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f9e4cdf4-44ab-387a-183b-c5f820d6d65e"));
        }
    }
}
