using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQasroIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ListOnQasro",
                schema: "real_estate",
                table: "Properties",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "QasroPublishedAt",
                schema: "real_estate",
                table: "Properties",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "qasro_integrations",
                schema: "real_estate",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QasroAgencyId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    KeyHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    KeyHint = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ConnectedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastUsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    OwnerTenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_qasro_integrations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_qasro_integrations_KeyHash",
                schema: "real_estate",
                table: "qasro_integrations",
                column: "KeyHash",
                unique: true,
                filter: "[KeyHash] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_qasro_integrations_OwnerTenantId",
                schema: "real_estate",
                table: "qasro_integrations",
                column: "OwnerTenantId",
                unique: true,
                filter: "[OwnerTenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "qasro_integrations",
                schema: "real_estate");

            migrationBuilder.DropColumn(
                name: "ListOnQasro",
                schema: "real_estate",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "QasroPublishedAt",
                schema: "real_estate",
                table: "Properties");
        }
    }
}
