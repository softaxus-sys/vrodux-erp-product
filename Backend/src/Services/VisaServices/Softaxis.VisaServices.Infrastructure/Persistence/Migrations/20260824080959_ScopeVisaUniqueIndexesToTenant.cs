using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.VisaServices.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeVisaUniqueIndexesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_visa_cases_CaseNumber",
                schema: "visa",
                table: "visa_cases");

            migrationBuilder.CreateIndex(
                name: "IX_visa_cases_TenantId_CaseNumber",
                schema: "visa",
                table: "visa_cases",
                columns: new[] { "TenantId", "CaseNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_visa_cases_TenantId_CaseNumber",
                schema: "visa",
                table: "visa_cases");

            migrationBuilder.CreateIndex(
                name: "IX_visa_cases_CaseNumber",
                schema: "visa",
                table: "visa_cases",
                column: "CaseNumber",
                unique: true);
        }
    }
}
