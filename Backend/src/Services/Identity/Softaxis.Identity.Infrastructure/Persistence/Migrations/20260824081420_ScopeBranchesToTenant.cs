using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeBranchesToTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_branches_Code",
                schema: "identity",
                table: "branches");

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "identity",
                table: "branches",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_branches_TenantId",
                schema: "identity",
                table: "branches",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_branches_TenantId_Code",
                schema: "identity",
                table: "branches",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_branches_TenantId",
                schema: "identity",
                table: "branches");

            migrationBuilder.DropIndex(
                name: "IX_branches_TenantId_Code",
                schema: "identity",
                table: "branches");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "identity",
                table: "branches");

            migrationBuilder.CreateIndex(
                name: "IX_branches_Code",
                schema: "identity",
                table: "branches",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");
        }
    }
}
