using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOfflineSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClientRef",
                schema: "restaurant",
                table: "Orders",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OfflineOps",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OpId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Error = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProcessedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OfflineOps", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_TenantId_ClientRef",
                schema: "restaurant",
                table: "Orders",
                columns: new[] { "TenantId", "ClientRef" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [ClientRef] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OfflineOps_TenantId",
                schema: "restaurant",
                table: "OfflineOps",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_OfflineOps_TenantId_OpId",
                schema: "restaurant",
                table: "OfflineOps",
                columns: new[] { "TenantId", "OpId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OfflineOps",
                schema: "restaurant");

            migrationBuilder.DropIndex(
                name: "IX_Orders_TenantId_ClientRef",
                schema: "restaurant",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ClientRef",
                schema: "restaurant",
                table: "Orders");
        }
    }
}
