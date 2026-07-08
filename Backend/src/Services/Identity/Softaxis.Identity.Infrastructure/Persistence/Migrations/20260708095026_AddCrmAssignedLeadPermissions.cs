using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCrmAssignedLeadPermissions : Migration
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
                    { new Guid("96055042-5858-15e2-98cd-5d8c1659be2f"), "view", "View crm leads-assigned", "crm.leads-assigned" },
                    { new Guid("a1c3b34c-1077-a49a-7944-2d55fd298f08"), "edit", "Edit crm leads-assigned", "crm.leads-assigned" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("96055042-5858-15e2-98cd-5d8c1659be2f"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("a1c3b34c-1077-a49a-7944-2d55fd298f08"));
        }
    }
}
