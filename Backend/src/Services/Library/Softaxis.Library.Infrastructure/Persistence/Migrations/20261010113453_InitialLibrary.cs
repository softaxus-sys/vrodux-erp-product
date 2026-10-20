using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Library.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "library");

            migrationBuilder.CreateTable(
                name: "branches",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "copies",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TitleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Barcode = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    ShelfLocation = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Condition = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TransitToBranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AcquiredOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_copies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "fines",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LoanId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AmountPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    SettledOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    PaymentMethod = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "loans",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CopyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TitleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IssuedOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    DueDate = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ReturnedOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ReturnBranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RenewalCount = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IssuedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_loans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "members",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberNumber = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IdNumber = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    MembershipTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HomeBranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    JoinedOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ExpiresOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_members", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "membership_types",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    MaxLoans = table.Column<int>(type: "int", nullable: false),
                    LoanDays = table.Column<int>(type: "int", nullable: false),
                    MaxRenewals = table.Column<int>(type: "int", nullable: false),
                    FinePerDay = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MaxReservations = table.Column<int>(type: "int", nullable: false),
                    AnnualFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_membership_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "reservations",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TitleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PickupBranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CopyId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReservedOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ReadyOn = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    HoldUntil = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reservations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "titles",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    Subtitle = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    Authors = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Isbn = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Publisher = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PublicationYear = table.Column<int>(type: "int", nullable: true),
                    Edition = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Language = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    MaterialType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    ReplacementCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_titles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_branches_TenantId",
                schema: "library",
                table: "branches",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_copies_BranchId_Status",
                schema: "library",
                table: "copies",
                columns: new[] { "BranchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_copies_TenantId",
                schema: "library",
                table: "copies",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_copies_TenantId_Barcode",
                schema: "library",
                table: "copies",
                columns: new[] { "TenantId", "Barcode" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_copies_TitleId",
                schema: "library",
                table: "copies",
                column: "TitleId");

            migrationBuilder.CreateIndex(
                name: "IX_fines_MemberId_Status",
                schema: "library",
                table: "fines",
                columns: new[] { "MemberId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_fines_TenantId",
                schema: "library",
                table: "fines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_loans_BranchId",
                schema: "library",
                table: "loans",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_loans_CopyId",
                schema: "library",
                table: "loans",
                column: "CopyId");

            migrationBuilder.CreateIndex(
                name: "IX_loans_MemberId",
                schema: "library",
                table: "loans",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_loans_Status_DueDate",
                schema: "library",
                table: "loans",
                columns: new[] { "Status", "DueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_loans_TenantId",
                schema: "library",
                table: "loans",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_loans_TitleId",
                schema: "library",
                table: "loans",
                column: "TitleId");

            migrationBuilder.CreateIndex(
                name: "IX_members_FullName",
                schema: "library",
                table: "members",
                column: "FullName");

            migrationBuilder.CreateIndex(
                name: "IX_members_MembershipTypeId",
                schema: "library",
                table: "members",
                column: "MembershipTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_members_TenantId",
                schema: "library",
                table: "members",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_members_TenantId_MemberNumber",
                schema: "library",
                table: "members",
                columns: new[] { "TenantId", "MemberNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_membership_types_TenantId",
                schema: "library",
                table: "membership_types",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_MemberId",
                schema: "library",
                table: "reservations",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_TenantId",
                schema: "library",
                table: "reservations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_TitleId_Status",
                schema: "library",
                table: "reservations",
                columns: new[] { "TitleId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_titles_Category",
                schema: "library",
                table: "titles",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_titles_Isbn",
                schema: "library",
                table: "titles",
                column: "Isbn");

            migrationBuilder.CreateIndex(
                name: "IX_titles_TenantId",
                schema: "library",
                table: "titles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_titles_Title",
                schema: "library",
                table: "titles",
                column: "Title");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "branches",
                schema: "library");

            migrationBuilder.DropTable(
                name: "copies",
                schema: "library");

            migrationBuilder.DropTable(
                name: "fines",
                schema: "library");

            migrationBuilder.DropTable(
                name: "loans",
                schema: "library");

            migrationBuilder.DropTable(
                name: "members",
                schema: "library");

            migrationBuilder.DropTable(
                name: "membership_types",
                schema: "library");

            migrationBuilder.DropTable(
                name: "reservations",
                schema: "library");

            migrationBuilder.DropTable(
                name: "titles",
                schema: "library");
        }
    }
}
