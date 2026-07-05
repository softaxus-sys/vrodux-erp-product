using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadConvertedCustomer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ConvertedCustomerId",
                schema: "crm",
                table: "leads",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_leads_ConvertedCustomerId",
                schema: "crm",
                table: "leads",
                column: "ConvertedCustomerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_leads_ConvertedCustomerId",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "ConvertedCustomerId",
                schema: "crm",
                table: "leads");
        }
    }
}
