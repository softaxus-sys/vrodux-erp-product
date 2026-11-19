using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowPermissions : Migration
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
                    { new Guid("146902a2-82cb-890d-78a7-4f31a84a986c"), "delete", "Delete workflow requests", "workflow.requests" },
                    { new Guid("1d031752-38fb-4ae7-8b4a-7d66c33a6457"), "approve", "Approve workflow approvals", "workflow.approvals" },
                    { new Guid("22c1c36c-47de-3bcd-e361-ee899d908fe0"), "delete", "Delete workflow repository", "workflow.repository" },
                    { new Guid("263b9707-ff5a-88b1-7068-1088c82e0cdf"), "view", "View workflow audit", "workflow.audit" },
                    { new Guid("2a650ef8-1c9d-f4e5-77b1-b8ead461c3ba"), "create", "Create workflow repository", "workflow.repository" },
                    { new Guid("311b0585-ddcc-721d-09a0-d2688dd2b05e"), "view", "View workflow approvals", "workflow.approvals" },
                    { new Guid("6e80fecf-4827-ff00-9308-1083b0ee4a93"), "edit", "Edit workflow requests", "workflow.requests" },
                    { new Guid("71f9875c-f970-56f1-255c-4f9a58636f1e"), "view", "View workflow requests", "workflow.requests" },
                    { new Guid("74c2041a-8b89-872e-1cce-5595db5c6b0e"), "create", "Create workflow requests", "workflow.requests" },
                    { new Guid("7ad6937d-c729-99ff-0717-27843cd03746"), "export", "Export workflow audit", "workflow.audit" },
                    { new Guid("8aa48fa4-95c8-de4a-b256-995beafb6237"), "view", "View workflow repository", "workflow.repository" },
                    { new Guid("e25ba1cd-4793-4bf1-6222-a319d30deb86"), "edit", "Edit workflow admin", "workflow.admin" },
                    { new Guid("eac2ed93-540d-c2dc-4c79-bbe44422c6bb"), "edit", "Edit workflow approvals", "workflow.approvals" },
                    { new Guid("f3319666-31a1-465b-a387-2bced8da00d4"), "view", "View workflow admin", "workflow.admin" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("146902a2-82cb-890d-78a7-4f31a84a986c"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1d031752-38fb-4ae7-8b4a-7d66c33a6457"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("22c1c36c-47de-3bcd-e361-ee899d908fe0"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("263b9707-ff5a-88b1-7068-1088c82e0cdf"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("2a650ef8-1c9d-f4e5-77b1-b8ead461c3ba"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("311b0585-ddcc-721d-09a0-d2688dd2b05e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("6e80fecf-4827-ff00-9308-1083b0ee4a93"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("71f9875c-f970-56f1-255c-4f9a58636f1e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("74c2041a-8b89-872e-1cce-5595db5c6b0e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("7ad6937d-c729-99ff-0717-27843cd03746"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("8aa48fa4-95c8-de4a-b256-995beafb6237"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("e25ba1cd-4793-4bf1-6222-a319d30deb86"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("eac2ed93-540d-c2dc-4c79-bbe44422c6bb"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f3319666-31a1-465b-a387-2bced8da00d4"));
        }
    }
}
