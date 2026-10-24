using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderRelay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlatformActionRequests",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PrepMinutes = table.Column<int>(type: "int", nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RequestedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformActionRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlatformActionResults",
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
                    table.PrimaryKey("PK_PlatformActionResults", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RelayedOrderResults",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OrderNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RelayedOrderResults", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RelayedOrders",
                schema: "restaurant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Payload = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExternalRef = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RelayedOrders", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlatformActionRequests_BranchId_RequestedAt",
                schema: "restaurant",
                table: "PlatformActionRequests",
                columns: new[] { "BranchId", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PlatformActionRequests_OrderId",
                schema: "restaurant",
                table: "PlatformActionRequests",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformActionRequests_TenantId",
                schema: "restaurant",
                table: "PlatformActionRequests",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformActionResults_BranchId",
                schema: "restaurant",
                table: "PlatformActionResults",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformActionResults_TenantId",
                schema: "restaurant",
                table: "PlatformActionResults",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RelayedOrderResults_BranchId",
                schema: "restaurant",
                table: "RelayedOrderResults",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_RelayedOrderResults_TenantId",
                schema: "restaurant",
                table: "RelayedOrderResults",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RelayedOrders_BranchId_ReceivedAt",
                schema: "restaurant",
                table: "RelayedOrders",
                columns: new[] { "BranchId", "ReceivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RelayedOrders_ExternalRef",
                schema: "restaurant",
                table: "RelayedOrders",
                column: "ExternalRef");

            migrationBuilder.CreateIndex(
                name: "IX_RelayedOrders_TenantId",
                schema: "restaurant",
                table: "RelayedOrders",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlatformActionRequests",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "PlatformActionResults",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "RelayedOrderResults",
                schema: "restaurant");

            migrationBuilder.DropTable(
                name: "RelayedOrders",
                schema: "restaurant");
        }
    }
}
