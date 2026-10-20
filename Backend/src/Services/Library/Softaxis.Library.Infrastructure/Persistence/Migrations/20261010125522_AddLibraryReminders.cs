using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Library.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryReminders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "reminder_log",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    LoanId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReservationId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ToEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Error = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reminder_log", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "reminder_settings",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    DueSoonDays = table.Column<int>(type: "int", nullable: false),
                    OverdueEveryDays = table.Column<int>(type: "int", nullable: false),
                    OverdueMaxReminders = table.Column<int>(type: "int", nullable: false),
                    NotifyReady = table.Column<bool>(type: "bit", nullable: false),
                    LibraryName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TimeZoneId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LastDailyRunOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reminder_settings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_reminder_log_CreatedAt",
                schema: "library",
                table: "reminder_log",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_reminder_log_LoanId",
                schema: "library",
                table: "reminder_log",
                column: "LoanId");

            migrationBuilder.CreateIndex(
                name: "IX_reminder_log_TenantId",
                schema: "library",
                table: "reminder_log",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_reminder_log_TenantId_Key",
                schema: "library",
                table: "reminder_log",
                columns: new[] { "TenantId", "Key" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_reminder_settings_TenantId",
                schema: "library",
                table: "reminder_settings",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reminder_log",
                schema: "library");

            migrationBuilder.DropTable(
                name: "reminder_settings",
                schema: "library");
        }
    }
}
