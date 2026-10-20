using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Support.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTicketAttachmentObjectKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ObjectKey",
                schema: "support",
                table: "support_ticket_attachments",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ObjectKey",
                schema: "support",
                table: "support_ticket_attachments");
        }
    }
}
