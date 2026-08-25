using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.HR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkSchedulesAndLateMinutes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LateMinutes",
                schema: "hr",
                table: "attendance_logs",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "work_schedules",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    StartTime = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    EndTime = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    GraceMinutes = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    WorkingDays = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TimeZoneId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_schedules", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_work_schedules_IsDefault",
                schema: "hr",
                table: "work_schedules",
                column: "IsDefault");

            migrationBuilder.CreateIndex(
                name: "IX_work_schedules_TenantId",
                schema: "hr",
                table: "work_schedules",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "work_schedules",
                schema: "hr");

            migrationBuilder.DropColumn(
                name: "LateMinutes",
                schema: "hr",
                table: "attendance_logs");
        }
    }
}
