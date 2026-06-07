using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Sales.Infrastructure.Persistence.Migrations
{
    public partial class AddSalesReturns : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sales_returns", schema: "sales",
                columns: table => new
                {
                    Id           = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReturnNumber = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    OrderId      = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    OrderNumber  = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    CustomerId   = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RequestDate  = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false),
                    Status       = table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: false, defaultValue: "pending"),
                    Reason       = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: false),
                    ReasonDetail = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    RefundAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency     = table.Column<string>(type: "nvarchar(10)",  maxLength: 10,  nullable: true),
                    CreditNote   = table.Column<string>(type: "nvarchar(50)",  maxLength: 50,  nullable: true),
                    ProcessedBy  = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ProcessedDate= table.Column<string>(type: "nvarchar(20)",  maxLength: 20,  nullable: true),
                    RefundMethod = table.Column<string>(type: "nvarchar(30)",  maxLength: 30,  nullable: true),
                    IsDeleted    = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt    = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt    = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_sales_returns", x => x.Id));

            migrationBuilder.CreateTable(
                name: "sales_return_items", schema: "sales",
                columns: table => new
                {
                    Id          = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReturnId    = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Quantity    = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    UnitPrice   = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales_return_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_sales_return_items_sales_returns_ReturnId",
                        column: x => x.ReturnId,
                        principalSchema: "sales",
                        principalTable: "sales_returns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("IX_sales_return_items_ReturnId", schema: "sales", table: "sales_return_items", column: "ReturnId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable("sales_return_items", "sales");
            migrationBuilder.DropTable("sales_returns", "sales");
        }
    }
}
