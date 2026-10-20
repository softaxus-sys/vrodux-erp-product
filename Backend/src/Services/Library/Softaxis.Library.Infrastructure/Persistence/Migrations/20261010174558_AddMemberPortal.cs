using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Library.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMemberPortal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PortalFailedAttempts",
                schema: "library",
                table: "members",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "PortalLockedUntil",
                schema: "library",
                table: "members",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PortalPinHash",
                schema: "library",
                table: "members",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "portal_settings",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    AllowRenewals = table.Column<bool>(type: "bit", nullable: false),
                    AllowReservations = table.Column<bool>(type: "bit", nullable: false),
                    PublicCatalogue = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_portal_settings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_portal_settings_TenantId",
                schema: "library",
                table: "portal_settings",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "portal_settings",
                schema: "library");

            migrationBuilder.DropColumn(
                name: "PortalFailedAttempts",
                schema: "library",
                table: "members");

            migrationBuilder.DropColumn(
                name: "PortalLockedUntil",
                schema: "library",
                table: "members");

            migrationBuilder.DropColumn(
                name: "PortalPinHash",
                schema: "library",
                table: "members");
        }
    }
}
