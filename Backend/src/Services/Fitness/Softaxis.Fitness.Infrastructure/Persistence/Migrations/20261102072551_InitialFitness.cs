using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.Fitness.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialFitness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "fitness");

            migrationBuilder.CreateTable(
                name: "AlertStates",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LastSentOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlertStates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Bookings",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubscriptionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    WaitlistPosition = table.Column<int>(type: "int", nullable: true),
                    CreditUsed = table.Column<bool>(type: "bit", nullable: false),
                    BookedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CancelledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bookings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Branches",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    OpeningTime = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ClosingTime = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Capacity = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Branches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CheckIns",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubscriptionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    CheckedInAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CheckedOutAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Allowed = table.Column<bool>(type: "bit", nullable: false),
                    DenyReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Method = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    IsGuest = table.Column<bool>(type: "bit", nullable: false),
                    GuestName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    RecordedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RecordedByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CheckIns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ClassTypes",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Level = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    DurationMinutes = table.Column<int>(type: "int", nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    Color = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CreditCost = table.Column<int>(type: "int", nullable: false),
                    DropInPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Counters",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Value = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Counters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Equipment",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Brand = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Model = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    SerialNumber = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    PurchasedOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    PurchaseCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    WarrantyUntil = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ServiceIntervalDays = table.Column<int>(type: "int", nullable: false),
                    LastServicedOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    NextServiceOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Equipment", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Freezes",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubscriptionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ToDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Days = table.Column<int>(type: "int", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Freezes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Leads",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Gender = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Source = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Interest = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AssignedToUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AssignedToName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    TrialDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    FollowUpOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    LostReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Leads", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Lockers",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Number = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Area = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Size = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    MonthlyRate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AssignedFrom = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    AssignedUntil = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    OutOfUse = table.Column<bool>(type: "bit", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lockers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Maintenance",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EquipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Cost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PerformedBy = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    StatusAfter = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    RecordedByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Maintenance", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Measurements",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrainerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    MeasuredOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    WeightKg = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    HeightCm = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    BodyFatPct = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    MuscleMassKg = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ChestCm = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    WaistCm = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    HipsCm = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ArmCm = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ThighCm = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    RestingHeartRate = table.Column<int>(type: "int", nullable: true),
                    BloodPressure = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Measurements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Members",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberNumber = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Gender = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    DateOfBirth = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    NationalId = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    EmergencyName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    EmergencyPhone = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    HealthNotes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    FitnessGoal = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Source = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ReferredBy = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    PhotoData = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    HomeBranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TrainerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    JoinedOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    WaiverSignedOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    StatusReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    LeadId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Members", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Payments",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReceiptNumber = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubscriptionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PtPackageId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Method = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    PaidOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ReceivedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReceivedByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsVoided = table.Column<bool>(type: "bit", nullable: false),
                    VoidReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    VoidedByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    VoidedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Payments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Plans",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    DurationDays = table.Column<int>(type: "int", nullable: false),
                    Price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    JoiningFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ClassCredits = table.Column<int>(type: "int", nullable: true),
                    PtSessions = table.Column<int>(type: "int", nullable: false),
                    VisitsPerDay = table.Column<int>(type: "int", nullable: true),
                    TotalVisits = table.Column<int>(type: "int", nullable: true),
                    AllowFreeze = table.Column<bool>(type: "bit", nullable: false),
                    MaxFreezeDays = table.Column<int>(type: "int", nullable: false),
                    GuestPasses = table.Column<int>(type: "int", nullable: false),
                    AllBranches = table.Column<bool>(type: "bit", nullable: false),
                    AccessFrom = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    AccessUntil = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Plans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Programs",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Goal = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Level = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Weeks = table.Column<int>(type: "int", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ItemsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TrainerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StartDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Programs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PtPackages",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrainerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    TotalSessions = table.Column<int>(type: "int", nullable: false),
                    UsedSessions = table.Column<int>(type: "int", nullable: false),
                    Price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AmountPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    StartDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ExpiresOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsCancelled = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PtPackages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PtSessions",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PackageId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrainerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    StartTime = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    DurationMinutes = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    SessionLog = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Counted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PtSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sessions",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClassTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClassName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrainerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Date = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    StartTime = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    EndTime = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    CreditCost = table.Column<int>(type: "int", nullable: false),
                    Room = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    CancelReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    SeriesId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Settings",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberNumberPrefix = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    GraceDays = table.Column<int>(type: "int", nullable: false),
                    AllowCheckInWithDues = table.Column<bool>(type: "bit", nullable: false),
                    RequireWaiver = table.Column<bool>(type: "bit", nullable: false),
                    ExpiringWithinDays = table.Column<int>(type: "int", nullable: false),
                    LateCancelHours = table.Column<int>(type: "int", nullable: false),
                    ChargeCreditForNoShow = table.Column<bool>(type: "bit", nullable: false),
                    BookingWindowDays = table.Column<int>(type: "int", nullable: false),
                    ExpiryAlertsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Subscriptions",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MemberId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlanName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StartDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    EndDate = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    DurationDays = table.Column<int>(type: "int", nullable: false),
                    Price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    JoiningFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AmountPaid = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ClassCredits = table.Column<int>(type: "int", nullable: true),
                    ClassCreditsLeft = table.Column<int>(type: "int", nullable: true),
                    PtSessionsLeft = table.Column<int>(type: "int", nullable: false),
                    VisitsPerDay = table.Column<int>(type: "int", nullable: true),
                    TotalVisits = table.Column<int>(type: "int", nullable: true),
                    VisitsUsed = table.Column<int>(type: "int", nullable: false),
                    AllowFreeze = table.Column<bool>(type: "bit", nullable: false),
                    MaxFreezeDays = table.Column<int>(type: "int", nullable: false),
                    FreezeDaysUsed = table.Column<int>(type: "int", nullable: false),
                    GuestPassesLeft = table.Column<int>(type: "int", nullable: false),
                    AllBranches = table.Column<bool>(type: "bit", nullable: false),
                    AccessFrom = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    AccessUntil = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FrozenFrom = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CancelledOn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CancelReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    RenewedFromId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SoldByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SoldByName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subscriptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Trainers",
                schema: "fitness",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Specialties = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Certifications = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Bio = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LinkedUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SessionRate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CommissionPct = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PhotoData = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Trainers", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AlertStates_TenantId",
                schema: "fitness",
                table: "AlertStates",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_TenantId",
                schema: "fitness",
                table: "Bookings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_TenantId_SessionId_MemberId",
                schema: "fitness",
                table: "Bookings",
                columns: new[] { "TenantId", "SessionId", "MemberId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Branches_TenantId",
                schema: "fitness",
                table: "Branches",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CheckIns_BranchId_Date",
                schema: "fitness",
                table: "CheckIns",
                columns: new[] { "BranchId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_CheckIns_MemberId",
                schema: "fitness",
                table: "CheckIns",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_CheckIns_TenantId",
                schema: "fitness",
                table: "CheckIns",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ClassTypes_TenantId",
                schema: "fitness",
                table: "ClassTypes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Counters_TenantId",
                schema: "fitness",
                table: "Counters",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Counters_TenantId_Kind",
                schema: "fitness",
                table: "Counters",
                columns: new[] { "TenantId", "Kind" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Equipment_TenantId",
                schema: "fitness",
                table: "Equipment",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Freezes_TenantId",
                schema: "fitness",
                table: "Freezes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_TenantId",
                schema: "fitness",
                table: "Leads",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Lockers_TenantId",
                schema: "fitness",
                table: "Lockers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Maintenance_TenantId",
                schema: "fitness",
                table: "Maintenance",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Measurements_TenantId",
                schema: "fitness",
                table: "Measurements",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Members_TenantId",
                schema: "fitness",
                table: "Members",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Members_TenantId_MemberNumber",
                schema: "fitness",
                table: "Members",
                columns: new[] { "TenantId", "MemberNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PaidOn",
                schema: "fitness",
                table: "Payments",
                column: "PaidOn");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_TenantId",
                schema: "fitness",
                table: "Payments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_TenantId_ReceiptNumber",
                schema: "fitness",
                table: "Payments",
                columns: new[] { "TenantId", "ReceiptNumber" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Plans_TenantId",
                schema: "fitness",
                table: "Plans",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Programs_TenantId",
                schema: "fitness",
                table: "Programs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PtPackages_TenantId",
                schema: "fitness",
                table: "PtPackages",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PtSessions_TenantId",
                schema: "fitness",
                table: "PtSessions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PtSessions_TrainerId_Date",
                schema: "fitness",
                table: "PtSessions",
                columns: new[] { "TrainerId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_BranchId_Date",
                schema: "fitness",
                table: "Sessions",
                columns: new[] { "BranchId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_TenantId",
                schema: "fitness",
                table: "Sessions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Settings_TenantId",
                schema: "fitness",
                table: "Settings",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_MemberId_EndDate",
                schema: "fitness",
                table: "Subscriptions",
                columns: new[] { "MemberId", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_TenantId",
                schema: "fitness",
                table: "Subscriptions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Trainers_TenantId",
                schema: "fitness",
                table: "Trainers",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AlertStates",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Bookings",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Branches",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "CheckIns",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "ClassTypes",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Counters",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Equipment",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Freezes",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Leads",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Lockers",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Maintenance",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Measurements",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Members",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Payments",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Plans",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Programs",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "PtPackages",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "PtSessions",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Sessions",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Settings",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Subscriptions",
                schema: "fitness");

            migrationBuilder.DropTable(
                name: "Trainers",
                schema: "fitness");
        }
    }
}
