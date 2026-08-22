using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRecordTeamOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TeamId",
                schema: "crm",
                table: "leads",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TeamId",
                schema: "crm",
                table: "deals",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TeamId",
                schema: "crm",
                table: "customers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_leads_TeamId",
                schema: "crm",
                table: "leads",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_deals_TeamId",
                schema: "crm",
                table: "deals",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_customers_TeamId",
                schema: "crm",
                table: "customers",
                column: "TeamId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_leads_TeamId",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropIndex(
                name: "IX_deals_TeamId",
                schema: "crm",
                table: "deals");

            migrationBuilder.DropIndex(
                name: "IX_customers_TeamId",
                schema: "crm",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "TeamId",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "TeamId",
                schema: "crm",
                table: "deals");

            migrationBuilder.DropColumn(
                name: "TeamId",
                schema: "crm",
                table: "customers");
        }
    }
}
