using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Calendar.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCalendar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "calendar");

            migrationBuilder.CreateTable(
                name: "calendar_connections",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AccountEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    Credentials = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SyncToken = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "disconnected"),
                    LastSyncAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_calendar_connections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "calendar_events",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Location = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    StartUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsAllDay = table.Column<bool>(type: "bit", nullable: false),
                    TimeZone = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MeetUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Source = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsOrganizer = table.Column<bool>(type: "bit", nullable: false),
                    GoogleEventId = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    GoogleEtag = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SyncStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "local"),
                    SyncError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_calendar_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "calendar_attendees",
                schema: "calendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ResponseStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_calendar_attendees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_calendar_attendees_calendar_events_EventId",
                        column: x => x.EventId,
                        principalSchema: "calendar",
                        principalTable: "calendar_events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_calendar_attendees_Email",
                schema: "calendar",
                table: "calendar_attendees",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_attendees_EventId",
                schema: "calendar",
                table: "calendar_attendees",
                column: "EventId");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_attendees_TenantId",
                schema: "calendar",
                table: "calendar_attendees",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_connections_TenantId",
                schema: "calendar",
                table: "calendar_connections",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_connections_UserId",
                schema: "calendar",
                table: "calendar_connections",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_events_OwnerUserId_GoogleEventId",
                schema: "calendar",
                table: "calendar_events",
                columns: new[] { "OwnerUserId", "GoogleEventId" });

            migrationBuilder.CreateIndex(
                name: "IX_calendar_events_OwnerUserId_StartUtc",
                schema: "calendar",
                table: "calendar_events",
                columns: new[] { "OwnerUserId", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_calendar_events_TenantId",
                schema: "calendar",
                table: "calendar_events",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "calendar_attendees",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "calendar_connections",
                schema: "calendar");

            migrationBuilder.DropTable(
                name: "calendar_events",
                schema: "calendar");
        }
    }
}
