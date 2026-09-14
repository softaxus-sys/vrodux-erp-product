using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPortalListings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "portal_listings",
                schema: "crm",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Portal = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    ListingId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AgentUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AgentName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TeamId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    EnquiryCount = table.Column<int>(type: "int", nullable: false),
                    LastEnquiryAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_portal_listings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_portal_listings_AgentUserId",
                schema: "crm",
                table: "portal_listings",
                column: "AgentUserId");

            migrationBuilder.CreateIndex(
                name: "IX_portal_listings_TenantId",
                schema: "crm",
                table: "portal_listings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_portal_listings_TenantId_Portal_ListingId",
                schema: "crm",
                table: "portal_listings",
                columns: new[] { "TenantId", "Portal", "ListingId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [ListingId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_portal_listings_TenantId_Portal_Reference",
                schema: "crm",
                table: "portal_listings",
                columns: new[] { "TenantId", "Portal", "Reference" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [Reference] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "portal_listings",
                schema: "crm");
        }
    }
}
