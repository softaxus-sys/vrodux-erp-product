using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAiAutomationRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "automation_rules",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Agent = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    Instruction = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    RunAsUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RunAsUserName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Mode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Frequency = table.Column<int>(type: "int", nullable: false),
                    IntervalMinutes = table.Column<int>(type: "int", nullable: true),
                    HourUtc = table.Column<int>(type: "int", nullable: true),
                    MinuteUtc = table.Column<int>(type: "int", nullable: false),
                    DayOfWeekUtc = table.Column<int>(type: "int", nullable: true),
                    NotifyTelegram = table.Column<bool>(type: "bit", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    LastRunAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NextRunAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RunCount = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_automation_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "automation_runs",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RuleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RuleName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RunAsUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TriggeredBy = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Summary = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    ToolsUsed = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Error = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    PendingToolName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PendingArgumentsJson = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_automation_runs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_automation_rules_Enabled_NextRunAt",
                schema: "aiassistant",
                table: "automation_rules",
                columns: new[] { "Enabled", "NextRunAt" });

            migrationBuilder.CreateIndex(
                name: "IX_automation_rules_TenantId",
                schema: "aiassistant",
                table: "automation_rules",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_automation_runs_RuleId_StartedAt",
                schema: "aiassistant",
                table: "automation_runs",
                columns: new[] { "RuleId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_automation_runs_Status",
                schema: "aiassistant",
                table: "automation_runs",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_automation_runs_TenantId",
                schema: "aiassistant",
                table: "automation_runs",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "automation_rules",
                schema: "aiassistant");

            migrationBuilder.DropTable(
                name: "automation_runs",
                schema: "aiassistant");
        }
    }
}
