using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountTypeAndCurrencyMasters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CurrencyCode",
                schema: "finance",
                table: "journal_entries",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "AED");

            migrationBuilder.AddColumn<string>(
                name: "CurrencyCode",
                schema: "finance",
                table: "invoices",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "AED");

            migrationBuilder.AddColumn<string>(
                name: "CurrencyCode",
                schema: "finance",
                table: "expenses",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "AED");

            migrationBuilder.AddColumn<Guid>(
                name: "AccountTypeId",
                schema: "finance",
                table: "accounts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrencyCode",
                schema: "finance",
                table: "accounts",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "AED");

            migrationBuilder.CreateTable(
                name: "account_types",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NormalBalance = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_account_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "currencies",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Symbol = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    DecimalPlaces = table.Column<int>(type: "int", nullable: false),
                    IsBaseCurrency = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_currencies", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_accounts_AccountTypeId",
                schema: "finance",
                table: "accounts",
                column: "AccountTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_account_types_Code",
                schema: "finance",
                table: "account_types",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_account_types_TenantId",
                schema: "finance",
                table: "account_types",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_currencies_Code",
                schema: "finance",
                table: "currencies",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_currencies_TenantId",
                schema: "finance",
                table: "currencies",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_accounts_account_types_AccountTypeId",
                schema: "finance",
                table: "accounts",
                column: "AccountTypeId",
                principalSchema: "finance",
                principalTable: "account_types",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_accounts_account_types_AccountTypeId",
                schema: "finance",
                table: "accounts");

            migrationBuilder.DropTable(
                name: "account_types",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "currencies",
                schema: "finance");

            migrationBuilder.DropIndex(
                name: "IX_accounts_AccountTypeId",
                schema: "finance",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "CurrencyCode",
                schema: "finance",
                table: "journal_entries");

            migrationBuilder.DropColumn(
                name: "CurrencyCode",
                schema: "finance",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "CurrencyCode",
                schema: "finance",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "AccountTypeId",
                schema: "finance",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "CurrencyCode",
                schema: "finance",
                table: "accounts");
        }
    }
}
