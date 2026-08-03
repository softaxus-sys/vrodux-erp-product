using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerWalletAndCredit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CreditBalance",
                schema: "pos",
                table: "customers",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CreditLimit",
                schema: "pos",
                table: "customers",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "WalletBalance",
                schema: "pos",
                table: "customers",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "customer_wallet_transactions",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_wallet_transactions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_customer_wallet_transactions_CustomerId",
                schema: "pos",
                table: "customer_wallet_transactions",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_customer_wallet_transactions_OrderId",
                schema: "pos",
                table: "customer_wallet_transactions",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_customer_wallet_transactions_TenantId",
                schema: "pos",
                table: "customer_wallet_transactions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "customer_wallet_transactions",
                schema: "pos");

            migrationBuilder.DropColumn(
                name: "CreditBalance",
                schema: "pos",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "CreditLimit",
                schema: "pos",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "WalletBalance",
                schema: "pos",
                table: "customers");
        }
    }
}
