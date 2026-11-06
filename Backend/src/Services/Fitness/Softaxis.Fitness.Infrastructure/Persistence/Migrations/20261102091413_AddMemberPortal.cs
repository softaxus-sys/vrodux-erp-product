using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Fitness.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMemberPortal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PortalFailedAttempts",
                schema: "fitness",
                table: "Members",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "PortalLockedUntil",
                schema: "fitness",
                table: "Members",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PortalPinHash",
                schema: "fitness",
                table: "Members",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PortalSettings",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    AllowBooking = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PortalSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PortalSettings_TenantId",
                schema: "fitness",
                table: "PortalSettings",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PortalSettings",
                schema: "fitness");

            migrationBuilder.DropColumn(
                name: "PortalFailedAttempts",
                schema: "fitness",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "PortalLockedUntil",
                schema: "fitness",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "PortalPinHash",
                schema: "fitness",
                table: "Members");
        }
    }
}
