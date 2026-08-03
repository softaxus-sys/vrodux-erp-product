using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderBranchAndSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                schema: "restaurant",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CashierId",
                schema: "restaurant",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SessionId",
                schema: "restaurant",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_BranchId",
                schema: "restaurant",
                table: "Orders",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_SessionId",
                schema: "restaurant",
                table: "Orders",
                column: "SessionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_BranchId",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_SessionId",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BranchId",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CashierId",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "SessionId",
                schema: "restaurant",
                table: "Orders");
        }
    }
}
