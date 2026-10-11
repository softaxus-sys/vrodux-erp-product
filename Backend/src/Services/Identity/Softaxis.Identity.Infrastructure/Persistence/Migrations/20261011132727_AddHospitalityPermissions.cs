using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHospitalityPermissions : Migration
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
                    { new Guid("2c005a49-ceda-f574-96e7-6ac46a3cb48d"), "edit", "Edit hospitality bookings", "hospitality.bookings" },
                    { new Guid("6acc8105-d11b-71bd-71dc-22f9bc963c6c"), "edit", "Edit hospitality housekeeping", "hospitality.housekeeping" },
                    { new Guid("a89871f3-c76b-9358-0b5e-198e20f9bf2d"), "create", "Create hospitality housekeeping", "hospitality.housekeeping" },
                    { new Guid("d0cd454b-8006-8389-5933-282eba939c96"), "view", "View hospitality housekeeping", "hospitality.housekeeping" },
                    { new Guid("e5e30b52-1ec2-6071-5ed8-28444cac980b"), "view", "View hospitality bookings", "hospitality.bookings" },
                    { new Guid("ead375f4-474a-d074-0130-01f35b9eb44d"), "create", "Create hospitality bookings", "hospitality.bookings" },
                    { new Guid("fac04faf-6b8a-83b3-b764-b7690057653a"), "view", "View hospitality rooms", "hospitality.rooms" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2c005a49-ceda-f574-96e7-6ac46a3cb48d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6acc8105-d11b-71bd-71dc-22f9bc963c6c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a89871f3-c76b-9358-0b5e-198e20f9bf2d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("d0cd454b-8006-8389-5933-282eba939c96"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e5e30b52-1ec2-6071-5ed8-28444cac980b"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("ead375f4-474a-d074-0130-01f35b9eb44d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fac04faf-6b8a-83b3-b764-b7690057653a"));
        }
    }
}
