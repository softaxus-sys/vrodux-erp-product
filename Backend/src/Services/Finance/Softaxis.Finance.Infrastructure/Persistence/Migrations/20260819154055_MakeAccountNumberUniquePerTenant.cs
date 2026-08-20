using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeAccountNumberUniquePerTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_accounts_AccountNumber",
                schema: "finance",
                table: "accounts");

            migrationBuilder.DropIndex(
                name: "IX_account_types_Code",
                schema: "finance",
                table: "account_types");

            migrationBuilder.CreateIndex(
                name: "IX_accounts_AccountNumber",
                schema: "finance",
                table: "accounts",
                column: "AccountNumber");

            migrationBuilder.CreateIndex(
                name: "IX_accounts_TenantId_AccountNumber",
                schema: "finance",
                table: "accounts",
                columns: new[] { "TenantId", "AccountNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_account_types_Code",
                schema: "finance",
                table: "account_types",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_account_types_TenantId_Code",
                schema: "finance",
                table: "account_types",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_accounts_AccountNumber",
                schema: "finance",
                table: "accounts");

            migrationBuilder.DropIndex(
                name: "IX_accounts_TenantId_AccountNumber",
                schema: "finance",
                table: "accounts");

            migrationBuilder.DropIndex(
                name: "IX_account_types_Code",
                schema: "finance",
                table: "account_types");

            migrationBuilder.DropIndex(
                name: "IX_account_types_TenantId_Code",
                schema: "finance",
                table: "account_types");

            migrationBuilder.CreateIndex(
                name: "IX_accounts_AccountNumber",
                schema: "finance",
                table: "accounts",
                column: "AccountNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_account_types_Code",
                schema: "finance",
                table: "account_types",
                column: "Code",
                unique: true);
        }
    }
}
