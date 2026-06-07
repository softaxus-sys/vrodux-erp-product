using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "restaurant",
                table: "Tables",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "restaurant",
                table: "Reservations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "restaurant",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "restaurant",
                table: "OrderPayments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "restaurant",
                table: "OrderItems",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "restaurant",
                table: "MenuItems",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "restaurant",
                table: "MenuCategories",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tables_TenantId",
                schema: "restaurant",
                table: "Tables",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_TenantId",
                schema: "restaurant",
                table: "Reservations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_TenantId",
                schema: "restaurant",
                table: "Orders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderPayments_TenantId",
                schema: "restaurant",
                table: "OrderPayments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_TenantId",
                schema: "restaurant",
                table: "OrderItems",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_MenuItems_TenantId",
                schema: "restaurant",
                table: "MenuItems",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_MenuCategories_TenantId",
                schema: "restaurant",
                table: "MenuCategories",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tables_TenantId",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_TenantId",
                schema: "restaurant",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_Orders_TenantId",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_OrderPayments_TenantId",
                schema: "restaurant",
                table: "OrderPayments");

            migrationBuilder.DropIndex(
                name: "IX_OrderItems_TenantId",
                schema: "restaurant",
                table: "OrderItems");

            migrationBuilder.DropIndex(
                name: "IX_MenuItems_TenantId",
                schema: "restaurant",
                table: "MenuItems");

            migrationBuilder.DropIndex(
                name: "IX_MenuCategories_TenantId",
                schema: "restaurant",
                table: "MenuCategories");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "restaurant",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "restaurant",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "restaurant",
                table: "OrderPayments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "restaurant",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "restaurant",
                table: "MenuItems");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "restaurant",
                table: "MenuCategories");
        }
    }
}
