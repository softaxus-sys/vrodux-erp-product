using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AssignedToUserId",
                schema: "crm",
                table: "leads",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "lead_assignments",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LeadId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    FromUserName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ToUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ToUserName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    AssignedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AssignedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lead_assignments", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_leads_AssignedToUserId",
                schema: "crm",
                table: "leads",
                column: "AssignedToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_lead_assignments_LeadId",
                schema: "crm",
                table: "lead_assignments",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_lead_assignments_TenantId",
                schema: "crm",
                table: "lead_assignments",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lead_assignments",
                schema: "crm");

            migrationBuilder.DropIndex(
                name: "IX_leads_AssignedToUserId",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "AssignedToUserId",
                schema: "crm",
                table: "leads");
        }
    }
}
