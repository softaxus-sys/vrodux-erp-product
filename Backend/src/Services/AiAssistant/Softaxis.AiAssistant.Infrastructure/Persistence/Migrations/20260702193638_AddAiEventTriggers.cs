using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAiEventTriggers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EventKey",
                schema: "aiassistant",
                table: "automation_rules",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TriggerType",
                schema: "aiassistant",
                table: "automation_rules",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "schedule");

            migrationBuilder.CreateTable(
                name: "event_inbox",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventKey = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    EntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    PayloadJson = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Error = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RulesFired = table.Column<int>(type: "int", nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_inbox", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_automation_rules_Enabled_EventKey",
                schema: "aiassistant",
                table: "automation_rules",
                columns: new[] { "Enabled", "EventKey" });

            migrationBuilder.CreateIndex(
                name: "IX_event_inbox_EventKey",
                schema: "aiassistant",
                table: "event_inbox",
                column: "EventKey");

            migrationBuilder.CreateIndex(
                name: "IX_event_inbox_Status_NextAttemptAt",
                schema: "aiassistant",
                table: "event_inbox",
                columns: new[] { "Status", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_event_inbox_TenantId",
                schema: "aiassistant",
                table: "event_inbox",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_inbox",
                schema: "aiassistant");

            migrationBuilder.DropIndex(
                name: "IX_automation_rules_Enabled_EventKey",
                schema: "aiassistant",
                table: "automation_rules");

            migrationBuilder.DropColumn(
                name: "EventKey",
                schema: "aiassistant",
                table: "automation_rules");

            migrationBuilder.DropColumn(
                name: "TriggerType",
                schema: "aiassistant",
                table: "automation_rules");
        }
    }
}
