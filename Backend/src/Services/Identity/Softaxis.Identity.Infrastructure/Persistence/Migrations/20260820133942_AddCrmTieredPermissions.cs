using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCrmTieredPermissions : Migration
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
                    { new Guid("1e2be0c0-79c2-c14b-a19b-039c153b6628"), "edit", "Edit crm pipeline-assigned", "crm.pipeline-assigned" },
                    { new Guid("21661683-765b-ba41-8ac9-ec2031d5a40e"), "view", "View crm customers-team", "crm.customers-team" },
                    { new Guid("55782c45-9440-a19a-e23c-8707dc070cc7"), "view", "View crm pipeline-assigned", "crm.pipeline-assigned" },
                    { new Guid("652a770e-899d-06c3-f5fd-ed669afd9707"), "edit", "Edit crm customers-assigned", "crm.customers-assigned" },
                    { new Guid("687257f1-ed91-e4ad-c30c-fbeb8d916cec"), "view", "View crm customers-assigned", "crm.customers-assigned" },
                    { new Guid("bd393bcb-131c-928e-7ccb-4c4f77a443cb"), "edit", "Edit crm customers-team", "crm.customers-team" },
                    { new Guid("c715d2f9-ddb8-750e-499f-ead5e3157eee"), "view", "View crm pipeline-team", "crm.pipeline-team" },
                    { new Guid("f85dcbd8-c106-a1e9-35d5-4936769cb0b4"), "edit", "Edit crm pipeline-team", "crm.pipeline-team" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("1e2be0c0-79c2-c14b-a19b-039c153b6628"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("21661683-765b-ba41-8ac9-ec2031d5a40e"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("55782c45-9440-a19a-e23c-8707dc070cc7"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("652a770e-899d-06c3-f5fd-ed669afd9707"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("687257f1-ed91-e4ad-c30c-fbeb8d916cec"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("bd393bcb-131c-928e-7ccb-4c4f77a443cb"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("c715d2f9-ddb8-750e-499f-ead5e3157eee"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("f85dcbd8-c106-a1e9-35d5-4936769cb0b4"));
        }
    }
}
