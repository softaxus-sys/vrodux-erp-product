using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Messaging.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialMessaging : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "messaging");

            migrationBuilder.CreateTable(
                name: "wa_automations",
                schema: "messaging",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventKey = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    TemplateName = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    Language = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    VariableFields = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Watermark = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wa_automations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "wa_connections",
                schema: "messaging",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PhoneNumberId = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    WabaId = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    AccessTokenCipher = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    DisplayPhone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    VerifiedName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ConnectedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    WelcomeEnabled = table.Column<bool>(type: "bit", nullable: false),
                    WelcomeMessage = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    AwayEnabled = table.Column<bool>(type: "bit", nullable: false),
                    AwayMessage = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    TimeZoneId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    OpensAt = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    ClosesAt = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    WorkDays = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreateLeads = table.Column<bool>(type: "bit", nullable: false),
                    DefaultCountryCode = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wa_connections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "wa_conversations",
                schema: "messaging",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContactPhone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ContactName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RelatedType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    RelatedId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RelatedName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    LastInboundAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastMessageAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastMessagePreview = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UnreadCount = table.Column<int>(type: "int", nullable: false),
                    OptedOut = table.Column<bool>(type: "bit", nullable: false),
                    LastWelcomeAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastAwayAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wa_conversations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "wa_keyword_rules",
                schema: "messaging",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Keyword = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MatchType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Reply = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wa_keyword_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "wa_messages",
                schema: "messaging",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Direction = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Body = table.Column<string>(type: "nvarchar(max)", maxLength: 4096, nullable: false),
                    TemplateName = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    WaMessageId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Error = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Origin = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SentByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SentByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RelatedType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    RelatedId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StatusAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wa_messages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "wa_templates",
                schema: "messaging",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    MetaTemplateId = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    HeaderText = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    BodyText = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    FooterText = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    VariableCount = table.Column<int>(type: "int", nullable: false),
                    RejectedReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SyncedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wa_templates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_wa_automations_TenantId",
                schema: "messaging",
                table: "wa_automations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_wa_automations_TenantId_EventKey",
                schema: "messaging",
                table: "wa_automations",
                columns: new[] { "TenantId", "EventKey" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_wa_connections_PhoneNumberId",
                schema: "messaging",
                table: "wa_connections",
                column: "PhoneNumberId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_wa_connections_TenantId",
                schema: "messaging",
                table: "wa_connections",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_wa_conversations_LastMessageAt",
                schema: "messaging",
                table: "wa_conversations",
                column: "LastMessageAt");

            migrationBuilder.CreateIndex(
                name: "IX_wa_conversations_RelatedType_RelatedId",
                schema: "messaging",
                table: "wa_conversations",
                columns: new[] { "RelatedType", "RelatedId" });

            migrationBuilder.CreateIndex(
                name: "IX_wa_conversations_TenantId",
                schema: "messaging",
                table: "wa_conversations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_wa_conversations_TenantId_ContactPhone",
                schema: "messaging",
                table: "wa_conversations",
                columns: new[] { "TenantId", "ContactPhone" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_wa_keyword_rules_TenantId",
                schema: "messaging",
                table: "wa_keyword_rules",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_wa_messages_ConversationId",
                schema: "messaging",
                table: "wa_messages",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_wa_messages_RelatedType_RelatedId",
                schema: "messaging",
                table: "wa_messages",
                columns: new[] { "RelatedType", "RelatedId" });

            migrationBuilder.CreateIndex(
                name: "IX_wa_messages_TenantId",
                schema: "messaging",
                table: "wa_messages",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_wa_messages_WaMessageId",
                schema: "messaging",
                table: "wa_messages",
                column: "WaMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_wa_templates_TenantId",
                schema: "messaging",
                table: "wa_templates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_wa_templates_TenantId_Name_Language",
                schema: "messaging",
                table: "wa_templates",
                columns: new[] { "TenantId", "Name", "Language" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "wa_automations",
                schema: "messaging");

            migrationBuilder.DropTable(
                name: "wa_connections",
                schema: "messaging");

            migrationBuilder.DropTable(
                name: "wa_conversations",
                schema: "messaging");

            migrationBuilder.DropTable(
                name: "wa_keyword_rules",
                schema: "messaging");

            migrationBuilder.DropTable(
                name: "wa_messages",
                schema: "messaging");

            migrationBuilder.DropTable(
                name: "wa_templates",
                schema: "messaging");
        }
    }
}
