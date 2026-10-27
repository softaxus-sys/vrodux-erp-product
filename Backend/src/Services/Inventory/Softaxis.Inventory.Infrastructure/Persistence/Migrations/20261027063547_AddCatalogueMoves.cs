using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Inventory.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogueMoves : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "catalogue_moves",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductsMoved = table.Column<int>(type: "int", nullable: false),
                    AlreadyThere = table.Column<int>(type: "int", nullable: false),
                    CategoriesCreated = table.Column<int>(type: "int", nullable: false),
                    WarehousesCreated = table.Column<int>(type: "int", nullable: false),
                    StockBuckets = table.Column<int>(type: "int", nullable: false),
                    MovedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    MovedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Report = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_catalogue_moves", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_catalogue_moves_TenantId",
                schema: "inventory",
                table: "catalogue_moves",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "catalogue_moves",
                schema: "inventory");
        }
    }
}
