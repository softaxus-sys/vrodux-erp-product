using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.POS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCreditReminders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "credit_reminder_logs",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Error = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_reminder_logs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "credit_reminder_settings",
                schema: "pos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    DaysBeforeDue = table.Column<int>(type: "int", nullable: false),
                    OverdueAfterDays = table.Column<int>(type: "int", nullable: false),
                    RepeatEveryDays = table.Column<int>(type: "int", nullable: false),
                    MaxOverdueReminders = table.Column<int>(type: "int", nullable: false),
                    SenderName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CcEmail = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TimeZoneId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    LastDailyRunOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_reminder_settings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_credit_reminder_logs_CustomerId",
                schema: "pos",
                table: "credit_reminder_logs",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_credit_reminder_logs_Key",
                schema: "pos",
                table: "credit_reminder_logs",
                column: "Key",
                unique: true,
                filter: "[Key] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_credit_reminder_logs_TenantId",
                schema: "pos",
                table: "credit_reminder_logs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_credit_reminder_settings_TenantId",
                schema: "pos",
                table: "credit_reminder_settings",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "credit_reminder_logs",
                schema: "pos");

            migrationBuilder.DropTable(
                name: "credit_reminder_settings",
                schema: "pos");
        }
    }
}
