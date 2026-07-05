using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDealContacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "deal_contacts",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DealId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContactId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "other"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deal_contacts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_deal_contacts_DealId",
                schema: "crm",
                table: "deal_contacts",
                column: "DealId");

            migrationBuilder.CreateIndex(
                name: "IX_deal_contacts_DealId_ContactId",
                schema: "crm",
                table: "deal_contacts",
                columns: new[] { "DealId", "ContactId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_deal_contacts_TenantId",
                schema: "crm",
                table: "deal_contacts",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "deal_contacts",
                schema: "crm");
        }
    }
}
