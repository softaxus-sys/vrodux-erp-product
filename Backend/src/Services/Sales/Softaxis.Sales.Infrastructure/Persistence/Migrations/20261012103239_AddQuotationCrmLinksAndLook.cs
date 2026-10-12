using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Sales.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQuotationCrmLinksAndLook : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccentColor",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                schema: "sales",
                table: "sales_quotations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CrmCustomerId",
                schema: "sales",
                table: "sales_quotations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DealId",
                schema: "sales",
                table: "sales_quotations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FooterNote",
                schema: "sales",
                table: "sales_quotations",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LeadId",
                schema: "sales",
                table: "sales_quotations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LeadOwnerUserId",
                schema: "sales",
                table: "sales_quotations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowLogo",
                schema: "sales",
                table: "sales_quotations",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SourceTemplateId",
                schema: "sales",
                table: "sales_quotations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_CrmCustomerId",
                schema: "sales",
                table: "sales_quotations",
                column: "CrmCustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_DealId",
                schema: "sales",
                table: "sales_quotations",
                column: "DealId");

            migrationBuilder.CreateIndex(
                name: "IX_sales_quotations_LeadId",
                schema: "sales",
                table: "sales_quotations",
                column: "LeadId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_CrmCustomerId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_DealId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropIndex(
                name: "IX_sales_quotations_LeadId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "AccentColor",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "CrmCustomerId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "DealId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "FooterNote",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "LeadId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "LeadOwnerUserId",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "ShowLogo",
                schema: "sales",
                table: "sales_quotations");

            migrationBuilder.DropColumn(
                name: "SourceTemplateId",
                schema: "sales",
                table: "sales_quotations");
        }
    }
}
