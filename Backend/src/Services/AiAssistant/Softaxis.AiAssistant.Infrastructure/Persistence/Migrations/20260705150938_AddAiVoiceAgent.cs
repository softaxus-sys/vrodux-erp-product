using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAiVoiceAgent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "scheduled_calls",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LeadId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LeadName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    LeadContext = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AttemptCount = table.Column<int>(type: "int", nullable: false),
                    DueAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    VapiCallId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    EndedReason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DurationSeconds = table.Column<int>(type: "int", nullable: false),
                    TranscriptText = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RecordingUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Summary = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Error = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    LeadUpdated = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_scheduled_calls", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tenant_voice_settings",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    ProtectedVapiApiKey = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    VapiPhoneNumberId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    VapiAssistantId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    InboundKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    WebhookSecret = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RunAsUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CallDelayMinutes = table.Column<int>(type: "int", nullable: false),
                    MaxAttempts = table.Column<int>(type: "int", nullable: false),
                    MonthlyMinutesCap = table.Column<int>(type: "int", nullable: false),
                    MinutesUsedThisMonth = table.Column<decimal>(type: "decimal(12,2)", nullable: false),
                    UsageMonth = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    DefaultLanguage = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    AgentName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    CompanyName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CompanyDescription = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Industry = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Knowledge = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_voice_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "call_attempts",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ScheduledCallId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AttemptNumber = table.Column<int>(type: "int", nullable: false),
                    VapiCallId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Outcome = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    DurationSeconds = table.Column<int>(type: "int", nullable: false),
                    Error = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_call_attempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_call_attempts_scheduled_calls_ScheduledCallId",
                        column: x => x.ScheduledCallId,
                        principalSchema: "aiassistant",
                        principalTable: "scheduled_calls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_call_attempts_ScheduledCallId",
                schema: "aiassistant",
                table: "call_attempts",
                column: "ScheduledCallId");

            migrationBuilder.CreateIndex(
                name: "IX_call_attempts_TenantId",
                schema: "aiassistant",
                table: "call_attempts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_scheduled_calls_LeadId",
                schema: "aiassistant",
                table: "scheduled_calls",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_scheduled_calls_Status_DueAt",
                schema: "aiassistant",
                table: "scheduled_calls",
                columns: new[] { "Status", "DueAt" });

            migrationBuilder.CreateIndex(
                name: "IX_scheduled_calls_TenantId",
                schema: "aiassistant",
                table: "scheduled_calls",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_scheduled_calls_VapiCallId",
                schema: "aiassistant",
                table: "scheduled_calls",
                column: "VapiCallId");

            migrationBuilder.CreateIndex(
                name: "IX_tenant_voice_settings_InboundKey",
                schema: "aiassistant",
                table: "tenant_voice_settings",
                column: "InboundKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_voice_settings_TenantId",
                schema: "aiassistant",
                table: "tenant_voice_settings",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "call_attempts",
                schema: "aiassistant");

            migrationBuilder.DropTable(
                name: "tenant_voice_settings",
                schema: "aiassistant");

            migrationBuilder.DropTable(
                name: "scheduled_calls",
                schema: "aiassistant");
        }
    }
}
