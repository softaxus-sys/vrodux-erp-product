using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCrmReportingHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ConvertedAt",
                schema: "crm",
                table: "leads",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ClosedAt",
                schema: "crm",
                table: "deals",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "deal_stage_history",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DealId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromStage = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    ToStage = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Probability = table.Column<int>(type: "int", nullable: false),
                    ValueAtChange = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DaysInFromStage = table.Column<double>(type: "float", nullable: false),
                    ChangedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ChangedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deal_stage_history", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_leads_ConvertedAt",
                schema: "crm",
                table: "leads",
                column: "ConvertedAt");

            migrationBuilder.CreateIndex(
                name: "IX_deals_ClosedAt",
                schema: "crm",
                table: "deals",
                column: "ClosedAt");

            migrationBuilder.CreateIndex(
                name: "IX_deal_stage_history_CreatedAt_ToStage",
                schema: "crm",
                table: "deal_stage_history",
                columns: new[] { "CreatedAt", "ToStage" });

            migrationBuilder.CreateIndex(
                name: "IX_deal_stage_history_DealId",
                schema: "crm",
                table: "deal_stage_history",
                column: "DealId");

            migrationBuilder.CreateIndex(
                name: "IX_deal_stage_history_TenantId",
                schema: "crm",
                table: "deal_stage_history",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "deal_stage_history",
                schema: "crm");

            migrationBuilder.DropIndex(
                name: "IX_leads_ConvertedAt",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropIndex(
                name: "IX_deals_ClosedAt",
                schema: "crm",
                table: "deals");

            migrationBuilder.DropColumn(
                name: "ConvertedAt",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "ClosedAt",
                schema: "crm",
                table: "deals");
        }
    }
}
