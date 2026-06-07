using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBankingAndTax : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bank_accounts",
                schema: "finance",
                columns: table => new
                {
                    Id               = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountName      = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    BankName         = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    AccountNumber    = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    Iban             = table.Column<string>(type: "nvarchar(34)",  maxLength: 34,  nullable: false),
                    Currency         = table.Column<string>(type: "nvarchar(10)",  maxLength: 10,  nullable: false),
                    Balance          = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AvailableBalance = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status           = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false, defaultValue: "active"),
                    AccountType      = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false, defaultValue: "current"),
                    LastSynced       = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt        = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt        = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted        = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_accounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bank_transactions",
                schema: "finance",
                columns: table => new
                {
                    Id          = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountId   = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date        = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Reference   = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Amount      = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Type        = table.Column<string>(type: "nvarchar(10)",  maxLength: 10,  nullable: false),
                    Category    = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    Reconciled  = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Balance     = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAt   = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_transactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bank_transactions_bank_accounts_AccountId",
                        column: x => x.AccountId,
                        principalSchema: "finance",
                        principalTable: "bank_accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tax_periods",
                schema: "finance",
                columns: table => new
                {
                    Id        = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Period    = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FromDate  = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ToDate    = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status    = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "open"),
                    OutputVat = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    InputVat  = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DueDate   = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FiledDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    PaidDate  = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Penalty   = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tax_periods", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tax_transactions",
                schema: "finance",
                columns: table => new
                {
                    Id          = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PeriodId    = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date        = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false),
                    Type        = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false),
                    Reference   = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Amount      = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    VatAmount   = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    VatRate     = table.Column<decimal>(type: "decimal(5,2)",  precision: 5,  scale: 2, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt   = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tax_transactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tax_transactions_tax_periods_PeriodId",
                        column: x => x.PeriodId,
                        principalSchema: "finance",
                        principalTable: "tax_periods",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bank_transactions_AccountId",
                schema: "finance",
                table: "bank_transactions",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_tax_transactions_PeriodId",
                schema: "finance",
                table: "tax_transactions",
                column: "PeriodId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "tax_transactions", schema: "finance");
            migrationBuilder.DropTable(name: "tax_periods",      schema: "finance");
            migrationBuilder.DropTable(name: "bank_transactions",schema: "finance");
            migrationBuilder.DropTable(name: "bank_accounts",    schema: "finance");
        }
    }
}
