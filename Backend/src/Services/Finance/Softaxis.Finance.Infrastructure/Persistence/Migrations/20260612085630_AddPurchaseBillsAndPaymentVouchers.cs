using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseBillsAndPaymentVouchers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payment_vouchers",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VoucherNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SupplierId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SupplierName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PaymentDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PaymentMethod = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
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
                    table.PrimaryKey("PK_payment_vouchers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payment_vouchers_accounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalSchema: "finance",
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payment_vouchers_suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalSchema: "finance",
                        principalTable: "suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "purchase_bills",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BillNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SupplierId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SupplierName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    BillDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DueDate = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TaxRate = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    CurrencyCode = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false, defaultValue: "AED"),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "draft"),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    AmountPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_bills", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_bills_suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalSchema: "finance",
                        principalTable: "suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payment_allocations",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PaymentVoucherId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BillId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AmountApplied = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_allocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payment_allocations_payment_vouchers_PaymentVoucherId",
                        column: x => x.PaymentVoucherId,
                        principalSchema: "finance",
                        principalTable: "payment_vouchers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payment_allocations_purchase_bills_BillId",
                        column: x => x.BillId,
                        principalSchema: "finance",
                        principalTable: "purchase_bills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "purchase_bill_items",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BillId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_bill_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_bill_items_purchase_bills_BillId",
                        column: x => x.BillId,
                        principalSchema: "finance",
                        principalTable: "purchase_bills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_payment_allocations_BillId",
                schema: "finance",
                table: "payment_allocations",
                column: "BillId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_allocations_PaymentVoucherId",
                schema: "finance",
                table: "payment_allocations",
                column: "PaymentVoucherId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_allocations_TenantId",
                schema: "finance",
                table: "payment_allocations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_vouchers_BankAccountId",
                schema: "finance",
                table: "payment_vouchers",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_vouchers_Status",
                schema: "finance",
                table: "payment_vouchers",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_payment_vouchers_SupplierId",
                schema: "finance",
                table: "payment_vouchers",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_vouchers_TenantId",
                schema: "finance",
                table: "payment_vouchers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_vouchers_VoucherNumber",
                schema: "finance",
                table: "payment_vouchers",
                column: "VoucherNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_purchase_bill_items_BillId",
                schema: "finance",
                table: "purchase_bill_items",
                column: "BillId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_bill_items_TenantId",
                schema: "finance",
                table: "purchase_bill_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_bills_BillNumber",
                schema: "finance",
                table: "purchase_bills",
                column: "BillNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_purchase_bills_DueDate",
                schema: "finance",
                table: "purchase_bills",
                column: "DueDate");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_bills_Status",
                schema: "finance",
                table: "purchase_bills",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_bills_SupplierId",
                schema: "finance",
                table: "purchase_bills",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_bills_TenantId",
                schema: "finance",
                table: "purchase_bills",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "payment_allocations",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "purchase_bill_items",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "payment_vouchers",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "purchase_bills",
                schema: "finance");
        }
    }
}
