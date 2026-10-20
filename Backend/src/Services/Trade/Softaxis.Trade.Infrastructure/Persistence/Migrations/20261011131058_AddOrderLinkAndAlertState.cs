using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Trade.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderLinkAndAlertState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LinkedOrderId",
                schema: "trade",
                table: "shipments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LinkedOrderType",
                schema: "trade",
                table: "shipments",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "alert_states",
                schema: "trade",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LastDigestDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alert_states", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_alert_states_TenantId",
                schema: "trade",
                table: "alert_states",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "alert_states",
                schema: "trade");

            migrationBuilder.DropColumn(
                name: "LinkedOrderId",
                schema: "trade",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "LinkedOrderType",
                schema: "trade",
                table: "shipments");
        }
    }
}
