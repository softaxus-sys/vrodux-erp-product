using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Finance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeCurrencyRatesGlobal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_exchange_rates_TenantId",
                schema: "finance",
                table: "exchange_rates");

            migrationBuilder.DropIndex(
                name: "IX_currencies_TenantId",
                schema: "finance",
                table: "currencies");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "exchange_rates");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "finance",
                table: "currencies");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "exchange_rates",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "finance",
                table: "currencies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_exchange_rates_TenantId",
                schema: "finance",
                table: "exchange_rates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_currencies_TenantId",
                schema: "finance",
                table: "currencies",
                column: "TenantId");
        }
    }
}
