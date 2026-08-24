using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAiConversations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_conversations",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_conversations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ai_chat_messages",
                schema: "aiassistant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_chat_messages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ai_chat_messages_ai_conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalSchema: "aiassistant",
                        principalTable: "ai_conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ai_chat_messages_ConversationId",
                schema: "aiassistant",
                table: "ai_chat_messages",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_ai_chat_messages_TenantId",
                schema: "aiassistant",
                table: "ai_chat_messages",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ai_conversations_TenantId",
                schema: "aiassistant",
                table: "ai_conversations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ai_conversations_UserId",
                schema: "aiassistant",
                table: "ai_conversations",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_chat_messages",
                schema: "aiassistant");

            migrationBuilder.DropTable(
                name: "ai_conversations",
                schema: "aiassistant");
        }
    }
}
