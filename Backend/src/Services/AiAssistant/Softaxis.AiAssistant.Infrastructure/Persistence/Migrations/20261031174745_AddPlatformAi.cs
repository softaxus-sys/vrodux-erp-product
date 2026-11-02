using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformAi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "platform_ai_settings",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Model = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    ProtectedApiKey = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MonthlyMessageCapPerTenant = table.Column<int>(type: "int", nullable: false),
                    NudgeEveryMessages = table.Column<int>(type: "int", nullable: false),
                    ShowOwnKeyBanner = table.Column<bool>(type: "bit", nullable: false),
                    VoiceEnabled = table.Column<bool>(type: "bit", nullable: false),
                    SttModel = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    TtsModel = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    TtsVoice = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    VoiceMonthlyCapPerTenant = table.Column<int>(type: "int", nullable: false),
                    ProtectedVoiceApiKey = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platform_ai_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "platform_ai_usage",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Month = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: false),
                    Messages = table.Column<int>(type: "int", nullable: false),
                    VoiceTurns = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platform_ai_usage", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_platform_ai_usage_Month",
                schema: "aiassistant",
                table: "platform_ai_usage",
                column: "Month");

            migrationBuilder.CreateIndex(
                name: "IX_platform_ai_usage_TenantId",
                schema: "aiassistant",
                table: "platform_ai_usage",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "platform_ai_settings",
                schema: "aiassistant");

            migrationBuilder.DropTable(
                name: "platform_ai_usage",
                schema: "aiassistant");
        }
    }
}
