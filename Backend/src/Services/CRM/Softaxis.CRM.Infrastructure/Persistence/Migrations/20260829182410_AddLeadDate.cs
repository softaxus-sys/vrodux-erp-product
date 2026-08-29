using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LeadDate",
                schema: "crm",
                table: "leads",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            // Backfilled here rather than by a background job: the column is the list's default
            // sort, and every existing row would otherwise carry 0001-01-01 and sort as the oldest
            // lead in the tenant. TRY_CONVERT because PlatformCreatedTime is a raw string from the
            // source — an unparseable one yields NULL and falls back to CreatedAt.
            migrationBuilder.Sql(@"
                UPDATE [crm].[leads]
                SET    [LeadDate] = COALESCE(TRY_CONVERT(datetime2, [PlatformCreatedTime]), [CreatedAt]);
            ");

            migrationBuilder.CreateIndex(
                name: "IX_leads_LeadDate",
                schema: "crm",
                table: "leads",
                column: "LeadDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_leads_LeadDate",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "LeadDate",
                schema: "crm",
                table: "leads");
        }
    }
}
