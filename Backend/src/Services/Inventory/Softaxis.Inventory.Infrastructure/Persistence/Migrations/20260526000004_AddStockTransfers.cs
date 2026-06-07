using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Inventory.Infrastructure.Persistence.Migrations
{
    public partial class AddStockTransfers : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "stock_transfers", schema: "inventory",
                columns: table => new
                {
                    Id                = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TransferNumber    = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    FromWarehouseId   = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    FromWarehouseName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ToWarehouseId     = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    ToWarehouseName   = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Status            = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false, defaultValue: "draft"),
                    RequestedBy       = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ApprovedBy        = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RequestDate       = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false),
                    ExpectedDate      = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false),
                    ReceivedDate      = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    TotalValue        = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes             = table.Column<string>(type: "nvarchar(1000)",maxLength: 1000,nullable: true),
                    IsDeleted         = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt         = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt         = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_stock_transfers", x => x.Id));

            migrationBuilder.CreateTable(
                name: "stock_transfer_items", schema: "inventory",
                columns: table => new
                {
                    Id          = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TransferId  = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StockItemId = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    ItemName    = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Sku         = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    Quantity    = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    UnitCost    = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_transfer_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_transfer_items_stock_transfers_TransferId",
                        column: x => x.TransferId,
                        principalSchema: "inventory",
                        principalTable: "stock_transfers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("IX_stock_transfer_items_TransferId", schema: "inventory", table: "stock_transfer_items", column: "TransferId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable("stock_transfer_items", "inventory");
            migrationBuilder.DropTable("stock_transfers", "inventory");
        }
    }
}
