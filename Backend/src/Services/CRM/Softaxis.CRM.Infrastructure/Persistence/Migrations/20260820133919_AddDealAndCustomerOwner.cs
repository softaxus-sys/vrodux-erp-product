using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDealAndCustomerOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AssignedToUserId",
                schema: "crm",
                table: "deals",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AccountManagerUserId",
                schema: "crm",
                table: "customers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_deals_AssignedToUserId",
                schema: "crm",
                table: "deals",
                column: "AssignedToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_customers_AccountManagerUserId",
                schema: "crm",
                table: "customers",
                column: "AccountManagerUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_deals_AssignedToUserId",
                schema: "crm",
                table: "deals");

            migrationBuilder.DropIndex(
                name: "IX_customers_AccountManagerUserId",
                schema: "crm",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "AssignedToUserId",
                schema: "crm",
                table: "deals");

            migrationBuilder.DropColumn(
                name: "AccountManagerUserId",
                schema: "crm",
                table: "customers");
        }
    }
}
