using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Restaurant.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderCounters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A plain table, deliberately not an EF entity: it is local bookkeeping for the order-number
            // counter (see OrderNumbering) and is never synced between servers.
            migrationBuilder.Sql(@"
                IF OBJECT_ID('[restaurant].[OrderCounters]') IS NULL
                CREATE TABLE [restaurant].[OrderCounters]
                (
                    [BranchId]     UNIQUEIDENTIFIER NOT NULL,
                    [BusinessDate] DATE             NOT NULL,
                    [LastNumber]   INT              NOT NULL,
                    CONSTRAINT [PK_OrderCounters] PRIMARY KEY ([BranchId], [BusinessDate])
                );");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS [restaurant].[OrderCounters];");
        }
    }
}
