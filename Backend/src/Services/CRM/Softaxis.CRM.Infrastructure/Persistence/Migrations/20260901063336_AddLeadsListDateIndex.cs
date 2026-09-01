using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadsListDateIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_leads_TenantId_IsDeleted_LeadDate_Id",
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_leads_LeadDate_Id",
                schema: "crm",
                table: "leads");

            migrationBuilder.CreateIndex(
                name: "IX_leads_TenantId_IsDeleted_LeadDate_Id",
                schema: "crm",
                table: "leads",
                columns: new[] { "TenantId", "IsDeleted", "LeadDate", "Id" },
                descending: new[] { false, false, true, false })
                .Annotation("SqlServer:Include", new[] { "Status" });
        }
    }
}
