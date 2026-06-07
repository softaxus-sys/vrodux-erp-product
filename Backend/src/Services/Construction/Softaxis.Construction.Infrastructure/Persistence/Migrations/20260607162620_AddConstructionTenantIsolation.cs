using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Construction.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddConstructionTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "construction",
                table: "sites",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "construction",
                table: "Rfqs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "construction",
                table: "projects",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "construction",
                table: "project_phases",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "construction",
                table: "Estimates",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "construction",
                table: "Contracts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "construction",
                table: "contractors",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "construction",
                table: "boqs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "construction",
                table: "boq_items",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_sites_TenantId",
                schema: "construction",
                table: "sites",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Rfqs_TenantId",
                schema: "construction",
                table: "Rfqs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_projects_TenantId",
                schema: "construction",
                table: "projects",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_project_phases_TenantId",
                schema: "construction",
                table: "project_phases",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Estimates_TenantId",
                schema: "construction",
                table: "Estimates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Contracts_TenantId",
                schema: "construction",
                table: "Contracts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_contractors_TenantId",
                schema: "construction",
                table: "contractors",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_boqs_TenantId",
                schema: "construction",
                table: "boqs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_boq_items_TenantId",
                schema: "construction",
                table: "boq_items",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_sites_TenantId",
                schema: "construction",
                table: "sites");

            migrationBuilder.DropIndex(
                name: "IX_Rfqs_TenantId",
                schema: "construction",
                table: "Rfqs");

            migrationBuilder.DropIndex(
                name: "IX_projects_TenantId",
                schema: "construction",
                table: "projects");

            migrationBuilder.DropIndex(
                name: "IX_project_phases_TenantId",
                schema: "construction",
                table: "project_phases");

            migrationBuilder.DropIndex(
                name: "IX_Estimates_TenantId",
                schema: "construction",
                table: "Estimates");

            migrationBuilder.DropIndex(
                name: "IX_Contracts_TenantId",
                schema: "construction",
                table: "Contracts");

            migrationBuilder.DropIndex(
                name: "IX_contractors_TenantId",
                schema: "construction",
                table: "contractors");

            migrationBuilder.DropIndex(
                name: "IX_boqs_TenantId",
                schema: "construction",
                table: "boqs");

            migrationBuilder.DropIndex(
                name: "IX_boq_items_TenantId",
                schema: "construction",
                table: "boq_items");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "construction",
                table: "sites");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "construction",
                table: "Rfqs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "construction",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "construction",
                table: "project_phases");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "construction",
                table: "Estimates");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "construction",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "construction",
                table: "contractors");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "construction",
                table: "boqs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "construction",
                table: "boq_items");
        }
    }
}
