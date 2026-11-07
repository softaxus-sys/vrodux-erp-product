using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Farming.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialFarming : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "farming");

            migrationBuilder.CreateTable(
                name: "Animals",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TagNumber = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Species = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Breed = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Sex = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    BirthDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DamId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SireId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Source = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    AcquiredOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    PurchasePrice = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    StatusDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    StatusReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Animals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Batches",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Species = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Breed = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StartDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    InitialCount = table.Column<int>(type: "int", nullable: false),
                    Area = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    InitialCost = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    ExpectedEndDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ClosedOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Batches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Breeding",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AnimalId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ServiceDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Method = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SireId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SireNote = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ExpectedOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Outcome = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    OutcomeOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Offspring = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Breeding", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Expenses",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PaidTo = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    RecordedByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Farms",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Location = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    AreaAcres = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Manager = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Farms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Feed",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FeedName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Uom = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Cost = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    AnimalId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    RecordedByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Feed", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Health",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Medicine = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Dose = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    VetName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Cost = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    NextDueOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    WithdrawalDays = table.Column<int>(type: "int", nullable: false),
                    AnimalId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    RecordedByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Health", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Mortality",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    AnimalId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Count = table.Column<int>(type: "int", nullable: false),
                    Cause = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    RecordedByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mortality", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Production",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Product = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Uom = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Session = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Grade = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Rejected = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    AnimalId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    RecordedByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Production", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sales",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Product = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Buyer = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    BuyerPhone = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Uom = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    AmountPaid = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    AnimalId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    HeadCount = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    RecordedByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Settings",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EnabledTypes = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    MilkUnit = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Units",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FarmId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Capacity = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Units", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Weights",
                schema: "farming",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    AnimalId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    WeightKg = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    SampleSize = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Weights", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Animals_TenantId",
                schema: "farming",
                table: "Animals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Animals_TenantId_TagNumber",
                schema: "farming",
                table: "Animals",
                columns: new[] { "TenantId", "TagNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Batches_TenantId",
                schema: "farming",
                table: "Batches",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Batches_TenantId_Code",
                schema: "farming",
                table: "Batches",
                columns: new[] { "TenantId", "Code" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Breeding_AnimalId",
                schema: "farming",
                table: "Breeding",
                column: "AnimalId");

            migrationBuilder.CreateIndex(
                name: "IX_Breeding_TenantId",
                schema: "farming",
                table: "Breeding",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_Date",
                schema: "farming",
                table: "Expenses",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_TenantId",
                schema: "farming",
                table: "Expenses",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Farms_TenantId",
                schema: "farming",
                table: "Farms",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Feed_Date",
                schema: "farming",
                table: "Feed",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_Feed_TenantId",
                schema: "farming",
                table: "Feed",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Health_NextDueOn",
                schema: "farming",
                table: "Health",
                column: "NextDueOn");

            migrationBuilder.CreateIndex(
                name: "IX_Health_TenantId",
                schema: "farming",
                table: "Health",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Mortality_BatchId",
                schema: "farming",
                table: "Mortality",
                column: "BatchId");

            migrationBuilder.CreateIndex(
                name: "IX_Mortality_TenantId",
                schema: "farming",
                table: "Mortality",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Production_AnimalId",
                schema: "farming",
                table: "Production",
                column: "AnimalId");

            migrationBuilder.CreateIndex(
                name: "IX_Production_BatchId",
                schema: "farming",
                table: "Production",
                column: "BatchId");

            migrationBuilder.CreateIndex(
                name: "IX_Production_Date_Product",
                schema: "farming",
                table: "Production",
                columns: new[] { "Date", "Product" });

            migrationBuilder.CreateIndex(
                name: "IX_Production_TenantId",
                schema: "farming",
                table: "Production",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Date",
                schema: "farming",
                table: "Sales",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_TenantId",
                schema: "farming",
                table: "Sales",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Settings_TenantId",
                schema: "farming",
                table: "Settings",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Units_TenantId",
                schema: "farming",
                table: "Units",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Weights_TenantId",
                schema: "farming",
                table: "Weights",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Animals",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Batches",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Breeding",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Expenses",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Farms",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Feed",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Health",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Mortality",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Production",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Sales",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Settings",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Units",
                schema: "farming");

            migrationBuilder.DropTable(
                name: "Weights",
                schema: "farming");
        }
    }
}
