using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.VisaServices.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVisaCaseInvoiceLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "InvoiceId",
                schema: "visa",
                table: "visa_cases",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                schema: "visa",
                table: "visa_cases",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InvoiceId",
                schema: "visa",
                table: "visa_cases");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                schema: "visa",
                table: "visa_cases");
        }
    }
}
