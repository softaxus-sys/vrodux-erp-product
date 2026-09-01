using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WidenLeadsListIndexForSummary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_leads_LeadDate_Id",
                schema: "crm",
                table: "leads");

            migrationBuilder.CreateIndex(
                name: "IX_leads_LeadDate_Id",
                schema: "crm",
                table: "leads",
                columns: new[] { "LeadDate", "Id" },
                descending: new[] { true, false })
                .Annotation("SqlServer:Include", new[] { "TenantId", "IsDeleted", "Status", "AssignedToUserId", "TeamId", "EstimatedValue", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_leads_LeadDate_Id",
                schema: "crm",
                table: "leads");

            migrationBuilder.CreateIndex(
                name: "IX_leads_LeadDate_Id",
                schema: "crm",
                table: "leads",
                columns: new[] { "LeadDate", "Id" },
                descending: new[] { true, false })
                .Annotation("SqlServer:Include", new[] { "TenantId", "IsDeleted", "Status", "AssignedToUserId", "TeamId" });
        }
    }
}
