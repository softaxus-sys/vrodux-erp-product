using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDealCustomerLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CustomerId",
                schema: "crm",
                table: "deals",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_deals_CustomerId",
                schema: "crm",
                table: "deals",
                column: "CustomerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_deals_CustomerId",
                schema: "crm",
                table: "deals");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                schema: "crm",
                table: "deals");
        }
    }
}
