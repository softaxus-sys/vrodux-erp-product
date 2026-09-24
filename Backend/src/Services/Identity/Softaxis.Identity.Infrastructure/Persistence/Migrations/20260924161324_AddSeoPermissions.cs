using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSeoPermissions : Migration
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
                    { new Guid("1133f32b-0599-2e43-8705-f2ba0e82c1a6"), "create", "Create seo sites", "seo.sites" },
                    { new Guid("224e4500-c960-6513-bbb4-52dbd1b77777"), "edit", "Edit seo fixes", "seo.fixes" },
                    { new Guid("3a6dc96d-9c1f-d1c4-1594-d1ba372f7726"), "edit", "Edit seo sites", "seo.sites" },
                    { new Guid("65584a54-e95e-4f76-0fab-38daed09bd06"), "view", "View seo sites", "seo.sites" },
                    { new Guid("6e4d81f0-5923-23a9-3d56-bae39dc6f307"), "view", "View seo fixes", "seo.fixes" },
                    { new Guid("a0e48fdc-50ae-66c5-1e13-f5c00b116e46"), "delete", "Delete seo sites", "seo.sites" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1133f32b-0599-2e43-8705-f2ba0e82c1a6"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("224e4500-c960-6513-bbb4-52dbd1b77777"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3a6dc96d-9c1f-d1c4-1594-d1ba372f7726"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("65584a54-e95e-4f76-0fab-38daed09bd06"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6e4d81f0-5923-23a9-3d56-bae39dc6f307"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a0e48fdc-50ae-66c5-1e13-f5c00b116e46"));
        }
    }
}
