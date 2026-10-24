using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchInstructions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BranchInstructionResults",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchInstructionResults", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BranchInstructions",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Method = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    RequestedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchInstructions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BranchInstructionResults_BranchId",
                schema: "restaurant",
                table: "BranchInstructionResults",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_BranchInstructionResults_TenantId",
                schema: "restaurant",
                table: "BranchInstructionResults",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_BranchInstructions_BranchId_RequestedAt",
                schema: "restaurant",
                table: "BranchInstructions",
                columns: new[] { "BranchId", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_BranchInstructions_OrderId",
                schema: "restaurant",
                table: "BranchInstructions",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_BranchInstructions_TenantId",
                schema: "restaurant",
                table: "BranchInstructions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BranchInstructionResults",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "BranchInstructions",
                schema: "restaurant");
        }
    }
}
