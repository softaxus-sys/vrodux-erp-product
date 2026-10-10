using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddManufacturingPlanningPermissions : Migration
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
                    { new Guid("11b455c1-ddcd-58e8-521a-ea9ed9d8d89d"), "edit", "Edit manufacturing work-centres", "manufacturing.work-centres" },
                    { new Guid("b73cc9d2-bc6a-2736-e582-7b45a475bf37"), "delete", "Delete manufacturing work-centres", "manufacturing.work-centres" },
                    { new Guid("e5a46fcb-e78a-04b8-c09f-5b253a7b7589"), "view", "View manufacturing planning", "manufacturing.planning" },
                    { new Guid("f8d13ec7-7d53-ce0a-3694-489045bce8c1"), "view", "View manufacturing work-centres", "manufacturing.work-centres" },
                    { new Guid("fccb1aee-3936-b46f-6ea5-71bce3365c63"), "create", "Create manufacturing work-centres", "manufacturing.work-centres" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("11b455c1-ddcd-58e8-521a-ea9ed9d8d89d"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("b73cc9d2-bc6a-2736-e582-7b45a475bf37"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e5a46fcb-e78a-04b8-c09f-5b253a7b7589"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f8d13ec7-7d53-ce0a-3694-489045bce8c1"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("fccb1aee-3936-b46f-6ea5-71bce3365c63"));
        }
    }
}
