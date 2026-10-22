using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMessagingPermissions : Migration
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
                    { new Guid("25cd9ea9-d15f-6ce4-635a-734f604d6f07"), "edit", "Edit messaging settings", "messaging.settings" },
                    { new Guid("2b29a626-8667-21f3-39d1-55d16248794c"), "view", "View messaging settings", "messaging.settings" },
                    { new Guid("755dc931-a686-f59d-54d5-9ae1e13e0fa8"), "send", "Send messaging inbox", "messaging.inbox" },
                    { new Guid("7a63a9b0-df3a-2941-4003-ab1109d25285"), "create", "Create messaging templates", "messaging.templates" },
                    { new Guid("cbfb3024-87eb-8eef-0318-72eca9c61007"), "view", "View messaging templates", "messaging.templates" },
                    { new Guid("dd215a1b-f549-0c14-a48a-5930ddeab50e"), "view", "View messaging inbox", "messaging.inbox" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("25cd9ea9-d15f-6ce4-635a-734f604d6f07"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2b29a626-8667-21f3-39d1-55d16248794c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("755dc931-a686-f59d-54d5-9ae1e13e0fa8"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("7a63a9b0-df3a-2941-4003-ab1109d25285"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("cbfb3024-87eb-8eef-0318-72eca9c61007"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("dd215a1b-f549-0c14-a48a-5930ddeab50e"));
        }
    }
}
