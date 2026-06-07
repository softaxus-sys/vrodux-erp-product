using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropLineItemProductFk : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Products can now live in either pos.products or inventory.products.
            // The DB-level FK and its auto-index from pos_line_items → pos.products
            // are removed; referential integrity is enforced in the application layer.
            migrationBuilder.DropForeignKey(
                name: "FK_pos_line_items_products_ProductId",
                schema: "pos",
                table: "pos_line_items");

            migrationBuilder.DropIndex(
                name: "IX_pos_line_items_ProductId",
                schema: "pos",
                table: "pos_line_items");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_pos_line_items_ProductId",
                schema: "pos",
                table: "pos_line_items",
                column: "ProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_pos_line_items_products_ProductId",
                schema: "pos",
                table: "pos_line_items",
                column: "ProductId",
                principalSchema: "pos",
                principalTable: "products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
