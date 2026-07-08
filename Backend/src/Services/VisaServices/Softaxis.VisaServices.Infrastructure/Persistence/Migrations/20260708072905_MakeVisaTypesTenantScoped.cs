using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.VisaServices.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeVisaTypesTenantScoped : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_visa_types_Code",
                schema: "visa",
                table: "visa_types");

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "visa",
                table: "visa_types",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_visa_types_Code",
                schema: "visa",
                table: "visa_types",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_visa_types_TenantId",
                schema: "visa",
                table: "visa_types",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_visa_types_Code",
                schema: "visa",
                table: "visa_types");

            migrationBuilder.DropIndex(
                name: "IX_visa_types_TenantId",
                schema: "visa",
                table: "visa_types");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "visa",
                table: "visa_types");

            migrationBuilder.CreateIndex(
                name: "IX_visa_types_Code",
                schema: "visa",
                table: "visa_types",
                column: "Code",
                unique: true);
        }
    }
}
