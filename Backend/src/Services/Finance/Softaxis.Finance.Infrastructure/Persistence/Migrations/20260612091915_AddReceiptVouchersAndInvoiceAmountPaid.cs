using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReceiptVouchersAndInvoiceAmountPaid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AmountPaid",
                schema: "finance",
                table: "invoices",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "receipt_vouchers",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VoucherNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ReceiptDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ReceiptMethod = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    BankAccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CurrencyCode = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false, defaultValue: "AED"),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "draft"),
                    PostedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_receipt_vouchers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_receipt_vouchers_accounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalSchema: "finance",
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_receipt_vouchers_customers_CustomerId",
                        column: x => x.CustomerId,
                        principalSchema: "finance",
                        principalTable: "customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "receipt_allocations",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReceiptVoucherId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AmountApplied = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_receipt_allocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_receipt_allocations_invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalSchema: "finance",
                        principalTable: "invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_receipt_allocations_receipt_vouchers_ReceiptVoucherId",
                        column: x => x.ReceiptVoucherId,
                        principalSchema: "finance",
                        principalTable: "receipt_vouchers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_receipt_allocations_InvoiceId",
                schema: "finance",
                table: "receipt_allocations",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_receipt_allocations_ReceiptVoucherId",
                schema: "finance",
                table: "receipt_allocations",
                column: "ReceiptVoucherId");

            migrationBuilder.CreateIndex(
                name: "IX_receipt_allocations_TenantId",
                schema: "finance",
                table: "receipt_allocations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_receipt_vouchers_BankAccountId",
                schema: "finance",
                table: "receipt_vouchers",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_receipt_vouchers_CustomerId",
                schema: "finance",
                table: "receipt_vouchers",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_receipt_vouchers_Status",
                schema: "finance",
                table: "receipt_vouchers",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_receipt_vouchers_TenantId",
                schema: "finance",
                table: "receipt_vouchers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_receipt_vouchers_VoucherNumber",
                schema: "finance",
                table: "receipt_vouchers",
                column: "VoucherNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "receipt_allocations",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "receipt_vouchers",
                schema: "finance");

            migrationBuilder.DropColumn(
                name: "AmountPaid",
                schema: "finance",
                table: "invoices");
        }
    }
}
