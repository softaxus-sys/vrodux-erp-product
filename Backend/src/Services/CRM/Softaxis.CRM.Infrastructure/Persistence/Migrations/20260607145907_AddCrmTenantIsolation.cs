using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.CRM.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCrmTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "healthcare",
                table: "treatment_plans",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "b2b",
                table: "support_tickets",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "education",
                table: "students",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "b2b",
                table: "service_contracts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "b2b",
                table: "proposals",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "insurance",
                table: "policy_renewals",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "insurance",
                table: "policies",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "healthcare",
                table: "patients",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "crm",
                table: "leads",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "education",
                table: "enrollments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "crm",
                table: "deals",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "crm",
                table: "customers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "crm",
                table: "contacts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "insurance",
                table: "claims",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "healthcare",
                table: "appointments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "education",
                table: "admissions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "crm",
                table: "activities",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_treatment_plans_TenantId",
                schema: "healthcare",
                table: "treatment_plans",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_support_tickets_TenantId",
                schema: "b2b",
                table: "support_tickets",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_students_TenantId",
                schema: "education",
                table: "students",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_service_contracts_TenantId",
                schema: "b2b",
                table: "service_contracts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_proposals_TenantId",
                schema: "b2b",
                table: "proposals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_policy_renewals_TenantId",
                schema: "insurance",
                table: "policy_renewals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_policies_TenantId",
                schema: "insurance",
                table: "policies",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_patients_TenantId",
                schema: "healthcare",
                table: "patients",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_leads_TenantId",
                schema: "crm",
                table: "leads",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_enrollments_TenantId",
                schema: "education",
                table: "enrollments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_deals_TenantId",
                schema: "crm",
                table: "deals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_customers_TenantId",
                schema: "crm",
                table: "customers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_contacts_TenantId",
                schema: "crm",
                table: "contacts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_claims_TenantId",
                schema: "insurance",
                table: "claims",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_appointments_TenantId",
                schema: "healthcare",
                table: "appointments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_admissions_TenantId",
                schema: "education",
                table: "admissions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_activities_TenantId",
                schema: "crm",
                table: "activities",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_treatment_plans_TenantId",
                schema: "healthcare",
                table: "treatment_plans");

            migrationBuilder.DropIndex(
                name: "IX_support_tickets_TenantId",
                schema: "b2b",
                table: "support_tickets");

            migrationBuilder.DropIndex(
                name: "IX_students_TenantId",
                schema: "education",
                table: "students");

            migrationBuilder.DropIndex(
                name: "IX_service_contracts_TenantId",
                schema: "b2b",
                table: "service_contracts");

            migrationBuilder.DropIndex(
                name: "IX_proposals_TenantId",
                schema: "b2b",
                table: "proposals");

            migrationBuilder.DropIndex(
                name: "IX_policy_renewals_TenantId",
                schema: "insurance",
                table: "policy_renewals");

            migrationBuilder.DropIndex(
                name: "IX_policies_TenantId",
                schema: "insurance",
                table: "policies");

            migrationBuilder.DropIndex(
                name: "IX_patients_TenantId",
                schema: "healthcare",
                table: "patients");

            migrationBuilder.DropIndex(
                name: "IX_leads_TenantId",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropIndex(
                name: "IX_enrollments_TenantId",
                schema: "education",
                table: "enrollments");

            migrationBuilder.DropIndex(
                name: "IX_deals_TenantId",
                schema: "crm",
                table: "deals");

            migrationBuilder.DropIndex(
                name: "IX_customers_TenantId",
                schema: "crm",
                table: "customers");

            migrationBuilder.DropIndex(
                name: "IX_contacts_TenantId",
                schema: "crm",
                table: "contacts");

            migrationBuilder.DropIndex(
                name: "IX_claims_TenantId",
                schema: "insurance",
                table: "claims");

            migrationBuilder.DropIndex(
                name: "IX_appointments_TenantId",
                schema: "healthcare",
                table: "appointments");

            migrationBuilder.DropIndex(
                name: "IX_admissions_TenantId",
                schema: "education",
                table: "admissions");

            migrationBuilder.DropIndex(
                name: "IX_activities_TenantId",
                schema: "crm",
                table: "activities");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "healthcare",
                table: "treatment_plans");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "b2b",
                table: "support_tickets");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "education",
                table: "students");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "b2b",
                table: "service_contracts");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "b2b",
                table: "proposals");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "insurance",
                table: "policy_renewals");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "insurance",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "healthcare",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "crm",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "education",
                table: "enrollments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "crm",
                table: "deals");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "crm",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "crm",
                table: "contacts");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "insurance",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "healthcare",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "education",
                table: "admissions");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "crm",
                table: "activities");
        }
    }
}
