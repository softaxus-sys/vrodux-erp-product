using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.VisaServices.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVisaChannels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "channel_accounts",
                schema: "visa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    EstablishmentCard = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AccountRef = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SecretProtected = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "connected"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_channel_accounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "govt_submissions",
                schema: "visa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisaCaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SubmissionType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ExternalReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "submitted"),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_govt_submissions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_channel_accounts_Channel",
                schema: "visa",
                table: "channel_accounts",
                column: "Channel");

            migrationBuilder.CreateIndex(
                name: "IX_channel_accounts_TenantId",
                schema: "visa",
                table: "channel_accounts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_govt_submissions_TenantId",
                schema: "visa",
                table: "govt_submissions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_govt_submissions_VisaCaseId",
                schema: "visa",
                table: "govt_submissions",
                column: "VisaCaseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "channel_accounts",
                schema: "visa");

            migrationBuilder.DropTable(
                name: "govt_submissions",
                schema: "visa");
        }
    }
}
