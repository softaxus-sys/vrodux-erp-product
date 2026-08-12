using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBillingAndRenameLegacyPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ─────────────────────────────────────────────────────────────────────────────
            // STEP 1 — Legacy plan rename. MUST run before anything reads the new catalogue.
            //
            // Tenant.Plan is persisted as a STRING (HasConversion<string>), so existing rows
            // literally hold 'Starter' / 'Business' / 'Enterprise'. The public catalogue is now
            // Micro / Starter / Professional / Enterprise, where "Starter" means something
            // DIFFERENT (10 seats, not 3). Without this rewrite:
            //   • legacy 'Starter' (3 seats) would silently parse as new Starter → free jump to 10
            //   • 'Business' would not parse at all → fall back to the lowest tier → seats cut 15 → 3
            //
            // Mapped by matching seat limits, not by name, so no tenant loses capacity:
            //   Starter(3) → Micro(3)   ·   Business(15) → Professional(50)   ·   Enterprise unchanged
            //
            // Order matters: rewriting Starter→Micro FIRST clears every legacy 'Starter' row before
            // the name is reused, so the two statements can never collide.
            //
            // QUOTED_IDENTIFIER is required for DML on [identity].[tenants] — it carries filtered
            // unique indexes (tenants.Slug), and SQL Server rejects the write without it.
            // ─────────────────────────────────────────────────────────────────────────────
            migrationBuilder.Sql(@"
                SET QUOTED_IDENTIFIER ON;
                UPDATE [identity].[tenants] SET [Plan] = 'Micro'        WHERE [Plan] = 'Starter';
                UPDATE [identity].[tenants] SET [Plan] = 'Professional' WHERE [Plan] = 'Business';
            ");

            // ── STEP 2 — Billing schema (additive) ───────────────────────────────────────
            migrationBuilder.AddColumn<int>(
                name: "LastTrialReminderDaysLeft",
                schema: "identity",
                table: "tenants",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignupBillingPeriod",
                schema: "identity",
                table: "tenants",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignupIntent",
                schema: "identity",
                table: "tenants",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UtmSource",
                schema: "identity",
                table: "tenants",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "billing_webhook_events",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ProviderEventId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Payload = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReceivedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Error = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false, defaultValue: "system"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_billing_webhook_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "subscription_invoices",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubscriptionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ProviderInvoiceId = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PeriodStart = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PeriodEnd = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PaidAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    HostedInvoiceUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    InvoicePdfUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false, defaultValue: "system"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subscription_invoices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "subscriptions",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Plan = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    BillingPeriod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ProviderCustomerId = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    ProviderSubscriptionId = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    CurrentPeriodStart = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CurrentPeriodEnd = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TrialEndsAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CanceledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CancelAtPeriodEnd = table.Column<bool>(type: "bit", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false, defaultValue: "system"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subscriptions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_billing_webhook_events_Provider_ProviderEventId",
                schema: "identity",
                table: "billing_webhook_events",
                columns: new[] { "Provider", "ProviderEventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subscription_invoices_Provider_ProviderInvoiceId",
                schema: "identity",
                table: "subscription_invoices",
                columns: new[] { "Provider", "ProviderInvoiceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subscription_invoices_SubscriptionId",
                schema: "identity",
                table: "subscription_invoices",
                column: "SubscriptionId");

            migrationBuilder.CreateIndex(
                name: "IX_subscription_invoices_TenantId",
                schema: "identity",
                table: "subscription_invoices",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_subscriptions_ProviderSubscriptionId",
                schema: "identity",
                table: "subscriptions",
                column: "ProviderSubscriptionId");

            migrationBuilder.CreateIndex(
                name: "IX_subscriptions_TenantId",
                schema: "identity",
                table: "subscriptions",
                column: "TenantId",
                unique: true,
                filter: "[IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "billing_webhook_events",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "subscription_invoices",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "subscriptions",
                schema: "identity");

            migrationBuilder.DropColumn(
                name: "LastTrialReminderDaysLeft",
                schema: "identity",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "SignupBillingPeriod",
                schema: "identity",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "SignupIntent",
                schema: "identity",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "UtmSource",
                schema: "identity",
                table: "tenants");

            // Reverse the plan rename last (mirror of Up's step 1). Professional→Business first, so
            // Micro→Starter cannot collide with a row that is still named Professional.
            // Note: any tenant created on the NEW 10-seat Starter tier has no legacy equivalent and
            // would land on the old 3-seat Starter — this Down path is for local rollback only.
            migrationBuilder.Sql(@"
                SET QUOTED_IDENTIFIER ON;
                UPDATE [identity].[tenants] SET [Plan] = 'Business' WHERE [Plan] = 'Professional';
                UPDATE [identity].[tenants] SET [Plan] = 'Starter'  WHERE [Plan] = 'Micro';
            ");
        }
    }
}
