using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderSplit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ParentOrderId",
                schema: "restaurant",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_ParentOrderId",
                schema: "restaurant",
                table: "Orders",
                column: "ParentOrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_Orders_ParentOrderId",
                schema: "restaurant",
                table: "Orders",
                column: "ParentOrderId",
                principalSchema: "restaurant",
                principalTable: "Orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Orders_Orders_ParentOrderId",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_ParentOrderId",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ParentOrderId",
                schema: "restaurant",
                table: "Orders");
        }
    }
}
