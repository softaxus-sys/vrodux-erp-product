using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPosPaymentGatewayPermission : Migration
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
                    { new Guid("3c512c86-e680-b7c3-5b33-ca6643841ae9"), "view", "View pos payment-gateway", "pos.payment-gateway" },
                    { new Guid("4dfa7787-df1d-5e6a-dbe4-6af343fcc554"), "edit", "Edit pos payment-gateway", "pos.payment-gateway" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("3c512c86-e680-b7c3-5b33-ca6643841ae9"));

            migrationBuilder.DeleteData(
                schema: "identity",
                table: "permissions",
                keyColumn: "Id",
                keyValue: new Guid("4dfa7787-df1d-5e6a-dbe4-6af343fcc554"));
        }
    }
}
