using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.RealEstate.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRealEstateTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "Tenants",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "SiteVisits",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "Reservations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "PropertyUnits",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "Properties",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "LeaseContracts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "Brokers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "Bookings",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_OwnerTenantId",
                schema: "real_estate",
                table: "Tenants",
                column: "OwnerTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SiteVisits_OwnerTenantId",
                schema: "real_estate",
                table: "SiteVisits",
                column: "OwnerTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_OwnerTenantId",
                schema: "real_estate",
                table: "Reservations",
                column: "OwnerTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyUnits_OwnerTenantId",
                schema: "real_estate",
                table: "PropertyUnits",
                column: "OwnerTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Properties_OwnerTenantId",
                schema: "real_estate",
                table: "Properties",
                column: "OwnerTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseContracts_OwnerTenantId",
                schema: "real_estate",
                table: "LeaseContracts",
                column: "OwnerTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Brokers_OwnerTenantId",
                schema: "real_estate",
                table: "Brokers",
                column: "OwnerTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_OwnerTenantId",
                schema: "real_estate",
                table: "Bookings",
                column: "OwnerTenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tenants_OwnerTenantId",
                schema: "real_estate",
                table: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_SiteVisits_OwnerTenantId",
                schema: "real_estate",
                table: "SiteVisits");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_OwnerTenantId",
                schema: "real_estate",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_PropertyUnits_OwnerTenantId",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropIndex(
                name: "IX_Properties_OwnerTenantId",
                schema: "real_estate",
                table: "Properties");

            migrationBuilder.DropIndex(
                name: "IX_LeaseContracts_OwnerTenantId",
                schema: "real_estate",
                table: "LeaseContracts");

            migrationBuilder.DropIndex(
                name: "IX_Brokers_OwnerTenantId",
                schema: "real_estate",
                table: "Brokers");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_OwnerTenantId",
                schema: "real_estate",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "SiteVisits");

            migrationBuilder.DropColumn(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "PropertyUnits");

            migrationBuilder.DropColumn(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "LeaseContracts");

            migrationBuilder.DropColumn(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "Brokers");

            migrationBuilder.DropColumn(
                name: "OwnerTenantId",
                schema: "real_estate",
                table: "Bookings");
        }
    }
}
