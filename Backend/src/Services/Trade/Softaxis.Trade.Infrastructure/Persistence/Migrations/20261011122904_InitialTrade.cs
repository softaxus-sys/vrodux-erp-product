using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Trade.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialTrade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "trade");

            migrationBuilder.CreateTable(
                name: "documents",
                schema: "trade",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Number = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IssueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpiryDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    FileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: true),
                    ContentType = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Content = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_documents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "parties",
                schema: "trade",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Country = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ContactName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TaxNumber = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_parties", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "shipments",
                schema: "trade",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShipmentNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Direction = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Mode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    PartnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ForwarderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AgentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    OrderReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Incoterm = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    BlNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CarrierName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    VesselOrFlight = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    OriginCountry = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OriginPort = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    DestinationCountry = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DestinationPort = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Etd = table.Column<DateOnly>(type: "date", nullable: true),
                    Eta = table.Column<DateOnly>(type: "date", nullable: true),
                    DepartedOn = table.Column<DateOnly>(type: "date", nullable: true),
                    ArrivedOn = table.Column<DateOnly>(type: "date", nullable: true),
                    ClearedOn = table.Column<DateOnly>(type: "date", nullable: true),
                    DeliveredOn = table.Column<DateOnly>(type: "date", nullable: true),
                    FreeDays = table.Column<int>(type: "int", nullable: true),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    ExchangeRate = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "shipment_containers",
                schema: "trade",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Number = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SealNumber = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    GrossWeightKg = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipment_containers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shipment_containers_shipments_ShipmentId",
                        column: x => x.ShipmentId,
                        principalSchema: "trade",
                        principalTable: "shipments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shipment_costs",
                schema: "trade",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Basis = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    VendorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    InvoiceReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PaidOn = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipment_costs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shipment_costs_shipments_ShipmentId",
                        column: x => x.ShipmentId,
                        principalSchema: "trade",
                        principalTable: "shipments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shipment_items",
                schema: "trade",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    HsCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    OriginCountry = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    WeightKg = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: true),
                    VolumeCbm = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: true),
                    Packages = table.Column<int>(type: "int", nullable: true),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Sku = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipment_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shipment_items_shipments_ShipmentId",
                        column: x => x.ShipmentId,
                        principalSchema: "trade",
                        principalTable: "shipments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shipment_milestones",
                schema: "trade",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OccurredOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RecordedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RecordedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipment_milestones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shipment_milestones_shipments_ShipmentId",
                        column: x => x.ShipmentId,
                        principalSchema: "trade",
                        principalTable: "shipments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shipment_payments",
                schema: "trade",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    PaidOn = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    LcNumber = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    BankName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    LcExpiry = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipment_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shipment_payments_shipments_ShipmentId",
                        column: x => x.ShipmentId,
                        principalSchema: "trade",
                        principalTable: "shipments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_documents_ExpiryDate",
                schema: "trade",
                table: "documents",
                column: "ExpiryDate");

            migrationBuilder.CreateIndex(
                name: "IX_documents_ShipmentId",
                schema: "trade",
                table: "documents",
                column: "ShipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_documents_TenantId",
                schema: "trade",
                table: "documents",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_parties_Kind",
                schema: "trade",
                table: "parties",
                column: "Kind");

            migrationBuilder.CreateIndex(
                name: "IX_parties_TenantId",
                schema: "trade",
                table: "parties",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_containers_ShipmentId",
                schema: "trade",
                table: "shipment_containers",
                column: "ShipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_containers_TenantId",
                schema: "trade",
                table: "shipment_containers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_costs_ShipmentId",
                schema: "trade",
                table: "shipment_costs",
                column: "ShipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_costs_TenantId",
                schema: "trade",
                table: "shipment_costs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_items_ShipmentId",
                schema: "trade",
                table: "shipment_items",
                column: "ShipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_items_TenantId",
                schema: "trade",
                table: "shipment_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_milestones_ShipmentId",
                schema: "trade",
                table: "shipment_milestones",
                column: "ShipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_milestones_TenantId",
                schema: "trade",
                table: "shipment_milestones",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_payments_DueDate",
                schema: "trade",
                table: "shipment_payments",
                column: "DueDate");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_payments_ShipmentId",
                schema: "trade",
                table: "shipment_payments",
                column: "ShipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_shipment_payments_TenantId",
                schema: "trade",
                table: "shipment_payments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_shipments_Eta",
                schema: "trade",
                table: "shipments",
                column: "Eta");

            migrationBuilder.CreateIndex(
                name: "IX_shipments_PartnerId",
                schema: "trade",
                table: "shipments",
                column: "PartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_shipments_Status",
                schema: "trade",
                table: "shipments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_shipments_TenantId",
                schema: "trade",
                table: "shipments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_shipments_TenantId_ShipmentNumber",
                schema: "trade",
                table: "shipments",
                columns: new[] { "TenantId", "ShipmentNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "documents",
                schema: "trade");

            migrationBuilder.DropTable(
                name: "parties",
                schema: "trade");

            migrationBuilder.DropTable(
                name: "shipment_containers",
                schema: "trade");

            migrationBuilder.DropTable(
                name: "shipment_costs",
                schema: "trade");

            migrationBuilder.DropTable(
                name: "shipment_items",
                schema: "trade");

            migrationBuilder.DropTable(
                name: "shipment_milestones",
                schema: "trade");

            migrationBuilder.DropTable(
                name: "shipment_payments",
                schema: "trade");

            migrationBuilder.DropTable(
                name: "shipments",
                schema: "trade");
        }
    }
}
