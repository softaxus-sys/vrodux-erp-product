using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Purchase.Infrastructure.Persistence.Migrations
{
    public partial class AddPurchaseApprovals : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "purchase_approvals", schema: "purchase",
                columns: table => new
                {
                    Id               = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestNumber    = table.Column<string>(type: "nvarchar(50)",   maxLength: 50,   nullable: false),
                    Title            = table.Column<string>(type: "nvarchar(300)",  maxLength: 300,  nullable: false),
                    RequestedBy      = table.Column<string>(type: "nvarchar(200)",  maxLength: 200,  nullable: false),
                    Department       = table.Column<string>(type: "nvarchar(100)",  maxLength: 100,  nullable: false),
                    RequestDate      = table.Column<string>(type: "nvarchar(20)",   maxLength: 20,   nullable: false),
                    RequiredBy       = table.Column<string>(type: "nvarchar(20)",   maxLength: 20,   nullable: false),
                    Status           = table.Column<string>(type: "nvarchar(20)",   maxLength: 20,   nullable: false, defaultValue: "pending"),
                    Priority         = table.Column<string>(type: "nvarchar(20)",   maxLength: 20,   nullable: false, defaultValue: "medium"),
                    Category         = table.Column<string>(type: "nvarchar(50)",   maxLength: 50,   nullable: false),
                    VendorSuggestion = table.Column<string>(type: "nvarchar(200)",  maxLength: 200,  nullable: true),
                    TotalAmount      = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency         = table.Column<string>(type: "nvarchar(10)",   maxLength: 10,   nullable: true),
                    Justification    = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    ApprovedBy       = table.Column<string>(type: "nvarchar(200)",  maxLength: 200,  nullable: true),
                    ApprovedDate     = table.Column<string>(type: "nvarchar(20)",   maxLength: 20,   nullable: true),
                    RejectionReason  = table.Column<string>(type: "nvarchar(500)",  maxLength: 500,  nullable: true),
                    ConvertedToPO    = table.Column<string>(type: "nvarchar(50)",   maxLength: 50,   nullable: true),
                    IsDeleted        = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt        = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt        = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_purchase_approvals", x => x.Id));

            migrationBuilder.CreateTable(
                name: "purchase_approval_items", schema: "purchase",
                columns: table => new
                {
                    Id                 = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApprovalId         = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Description        = table.Column<string>(type: "nvarchar(500)",  maxLength: 500, nullable: false),
                    Quantity           = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    EstimatedUnitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_approval_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_approval_items_purchase_approvals_ApprovalId",
                        column: x => x.ApprovalId,
                        principalSchema: "purchase",
                        principalTable: "purchase_approvals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("IX_purchase_approval_items_ApprovalId", schema: "purchase", table: "purchase_approval_items", column: "ApprovalId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable("purchase_approval_items", "purchase");
            migrationBuilder.DropTable("purchase_approvals", "purchase");
        }
    }
}
