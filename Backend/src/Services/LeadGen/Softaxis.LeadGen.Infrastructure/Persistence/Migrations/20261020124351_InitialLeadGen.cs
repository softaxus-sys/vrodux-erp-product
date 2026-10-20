using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Softaxis.LeadGen.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialLeadGen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "leadgen");

            migrationBuilder.CreateTable(
                name: "business_directory",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GooglePlaceId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NameKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    PrimaryType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    CountryCode = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    Region = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    City = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    Area = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    Latitude = table.Column<double>(type: "float", nullable: true),
                    Longitude = table.Column<double>(type: "float", nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    PhoneE164 = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: true),
                    PhoneType = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    Website = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Domain = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    EmailStatus = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    EmailIsRole = table.Column<bool>(type: "bit", nullable: false),
                    Social = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: true),
                    Rating = table.Column<decimal>(type: "decimal(3,2)", precision: 3, scale: 2, nullable: true),
                    ReviewCount = table.Column<int>(type: "int", nullable: true),
                    BusinessStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    GoogleMapsUri = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    FirstSeenAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EnrichedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TimesFound = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_business_directory", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "campaign_recipients",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProspectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(14)", maxLength: 14, nullable: false),
                    CurrentStep = table.Column<int>(type: "int", nullable: false),
                    NextSendAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastSentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ThreadId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_campaign_recipients", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "campaigns",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    MailboxId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    TimeZoneId = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    WindowStart = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    WindowEnd = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    SendDays = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DailyCap = table.Column<int>(type: "int", nullable: false),
                    StopOnReply = table.Column<bool>(type: "bit", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PauseReason = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_campaigns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "credit_ledger",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Amount = table.Column<int>(type: "int", nullable: false),
                    BalanceAfter = table.Column<long>(type: "bigint", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    RefType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    RefId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ActorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_ledger", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "credit_packs",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Credits = table.Column<int>(type: "int", nullable: false),
                    PriceMinor = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Badge = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_packs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "credit_purchases",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PackId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PackName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Credits = table.Column<int>(type: "int", nullable: false),
                    AmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ProviderRef = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    FailureReason = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_purchases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "credit_wallets",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Balance = table.Column<long>(type: "bigint", nullable: false),
                    LifetimePurchased = table.Column<long>(type: "bigint", nullable: false),
                    LifetimeSpent = table.Column<long>(type: "bigint", nullable: false),
                    LifetimeRefunded = table.Column<long>(type: "bigint", nullable: false),
                    TrialGranted = table.Column<bool>(type: "bit", nullable: false),
                    LowBalanceAlert = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_wallets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "global_suppressions",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Value = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_global_suppressions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "mailboxes",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(14)", maxLength: 14, nullable: false),
                    StatusReason = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Credentials = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SmtpHost = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    SmtpPort = table.Column<int>(type: "int", nullable: true),
                    ImapHost = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    ImapPort = table.Column<int>(type: "int", nullable: true),
                    Username = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    DailyLimit = table.Column<int>(type: "int", nullable: false),
                    WarmupStartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SentToday = table.Column<int>(type: "int", nullable: false),
                    SentTodayDate = table.Column<DateOnly>(type: "date", nullable: true),
                    LastSentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SyncCursor = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    LastSyncAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    TotalSent = table.Column<int>(type: "int", nullable: false),
                    TotalBounced = table.Column<int>(type: "int", nullable: false),
                    TotalComplaints = table.Column<int>(type: "int", nullable: false),
                    TotalReplies = table.Column<int>(type: "int", nullable: false),
                    SignatureText = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mailboxes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "messages",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ThreadId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MailboxId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RecipientId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StepNumber = table.Column<int>(type: "int", nullable: true),
                    Direction = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    FromAddress = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    ToAddress = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Cc = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Subject = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    BodyText = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    BodyHtml = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MessageIdHeader = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    InReplyTo = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    ProviderMessageId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Error = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    IsRead = table.Column<bool>(type: "bit", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_messages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "platform_settings",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    RevealCost = table.Column<int>(type: "int", nullable: false),
                    VerifiedEmailBonus = table.Column<int>(type: "int", nullable: false),
                    TrialGrantCredits = table.Column<int>(type: "int", nullable: false),
                    DailySearchLimit = table.Column<int>(type: "int", nullable: false),
                    DailyDiscoveryLimit = table.Column<int>(type: "int", nullable: false),
                    MaxResultsPerSearch = table.Column<int>(type: "int", nullable: false),
                    MaxRevealsPerRequest = table.Column<int>(type: "int", nullable: false),
                    PoolFreshDays = table.Column<int>(type: "int", nullable: false),
                    BounceRefundDays = table.Column<int>(type: "int", nullable: false),
                    AllowedCountries = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RequireSenderIdentity = table.Column<bool>(type: "bit", nullable: false),
                    MaxMailboxesPerWorkspace = table.Column<int>(type: "int", nullable: false),
                    MaxDailySendsPerMailbox = table.Column<int>(type: "int", nullable: false),
                    MaxDailySendsPerWorkspace = table.Column<int>(type: "int", nullable: false),
                    BounceRatePauseBp = table.Column<int>(type: "int", nullable: false),
                    ComplaintRatePauseBp = table.Column<int>(type: "int", nullable: false),
                    BlockSendingOnTrial = table.Column<bool>(type: "bit", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platform_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "profiles",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OfferSummary = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: true),
                    TargetCustomers = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: true),
                    DealSize = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CountryCode = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    PreferredRegions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PreferredCategories = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ExcludeKeywords = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    SenderBusinessName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    SenderAddress = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    SenderWebsite = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "prospects",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SearchJobId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DirectoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NameKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    PrimaryType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    CountryCode = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    Region = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    City = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    Area = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    Latitude = table.Column<double>(type: "float", nullable: true),
                    Longitude = table.Column<double>(type: "float", nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    PhoneE164 = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: true),
                    PhoneType = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    Website = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Domain = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    EmailStatus = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    EmailIsRole = table.Column<bool>(type: "bit", nullable: false),
                    Social = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: true),
                    Rating = table.Column<decimal>(type: "decimal(3,2)", precision: 3, scale: 2, nullable: true),
                    ReviewCount = table.Column<int>(type: "int", nullable: true),
                    BusinessStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    GoogleMapsUri = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    GooglePlaceId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsRevealed = table.Column<bool>(type: "bit", nullable: false),
                    RevealedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RevealedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreditsCharged = table.Column<int>(type: "int", nullable: false),
                    QualityScore = table.Column<int>(type: "int", nullable: false),
                    FitScore = table.Column<int>(type: "int", nullable: false),
                    ScoreNotes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    OwnerUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    OwnerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CrmLeadId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    LastVerifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prospects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "searches",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    CountryCode = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    Regions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Areas = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Categories = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Keywords = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    MaxResults = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Error = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    FoundCount = table.Column<int>(type: "int", nullable: false),
                    NewCount = table.Column<int>(type: "int", nullable: false),
                    DuplicateCount = table.Column<int>(type: "int", nullable: false),
                    RequestsMade = table.Column<int>(type: "int", nullable: false),
                    Progress = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_searches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "suppressions",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Value = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_suppressions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "threads",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MailboxId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProspectId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Counterparty = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Subject = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ProviderThreadId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Classification = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    MessageCount = table.Column<int>(type: "int", nullable: false),
                    UnreadCount = table.Column<int>(type: "int", nullable: false),
                    HasReply = table.Column<bool>(type: "bit", nullable: false),
                    AssignedUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AssignedName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false),
                    LastMessageAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Snippet = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_threads", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "campaign_steps",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Number = table.Column<int>(type: "int", nullable: false),
                    DelayDays = table.Column<int>(type: "int", nullable: false),
                    Subject = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "nvarchar(max)", maxLength: 8000, nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_campaign_steps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_campaign_steps_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "leadgen",
                        principalTable: "campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "prospect_contacts",
                schema: "leadgen",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProspectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    EmailStatus = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    Source = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prospect_contacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_prospect_contacts_prospects_ProspectId",
                        column: x => x.ProspectId,
                        principalSchema: "leadgen",
                        principalTable: "prospects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_business_directory_CountryCode_Region",
                schema: "leadgen",
                table: "business_directory",
                columns: new[] { "CountryCode", "Region" });

            migrationBuilder.CreateIndex(
                name: "IX_business_directory_GooglePlaceId",
                schema: "leadgen",
                table: "business_directory",
                column: "GooglePlaceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_campaign_recipients_Email",
                schema: "leadgen",
                table: "campaign_recipients",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_campaign_recipients_ProspectId",
                schema: "leadgen",
                table: "campaign_recipients",
                column: "ProspectId");

            migrationBuilder.CreateIndex(
                name: "IX_campaign_recipients_Status_NextSendAt",
                schema: "leadgen",
                table: "campaign_recipients",
                columns: new[] { "Status", "NextSendAt" });

            migrationBuilder.CreateIndex(
                name: "IX_campaign_recipients_TenantId",
                schema: "leadgen",
                table: "campaign_recipients",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_campaign_recipients_TenantId_CampaignId_ProspectId",
                schema: "leadgen",
                table: "campaign_recipients",
                columns: new[] { "TenantId", "CampaignId", "ProspectId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_campaign_steps_CampaignId",
                schema: "leadgen",
                table: "campaign_steps",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_campaign_steps_TenantId",
                schema: "leadgen",
                table: "campaign_steps",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_campaign_steps_TenantId_CampaignId_Number",
                schema: "leadgen",
                table: "campaign_steps",
                columns: new[] { "TenantId", "CampaignId", "Number" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_campaigns_MailboxId",
                schema: "leadgen",
                table: "campaigns",
                column: "MailboxId");

            migrationBuilder.CreateIndex(
                name: "IX_campaigns_Status",
                schema: "leadgen",
                table: "campaigns",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_campaigns_TenantId",
                schema: "leadgen",
                table: "campaigns",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_credit_ledger_CreatedAt",
                schema: "leadgen",
                table: "credit_ledger",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_credit_ledger_TenantId",
                schema: "leadgen",
                table: "credit_ledger",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_credit_ledger_TenantId_IdempotencyKey",
                schema: "leadgen",
                table: "credit_ledger",
                columns: new[] { "TenantId", "IdempotencyKey" },
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_credit_purchases_Provider_ProviderRef",
                schema: "leadgen",
                table: "credit_purchases",
                columns: new[] { "Provider", "ProviderRef" },
                unique: true,
                filter: "[ProviderRef] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_credit_purchases_TenantId",
                schema: "leadgen",
                table: "credit_purchases",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_credit_wallets_TenantId",
                schema: "leadgen",
                table: "credit_wallets",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_global_suppressions_Kind_Value",
                schema: "leadgen",
                table: "global_suppressions",
                columns: new[] { "Kind", "Value" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_mailboxes_TenantId",
                schema: "leadgen",
                table: "mailboxes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_mailboxes_TenantId_Address",
                schema: "leadgen",
                table: "mailboxes",
                columns: new[] { "TenantId", "Address" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_messages_CampaignId_Status",
                schema: "leadgen",
                table: "messages",
                columns: new[] { "CampaignId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_messages_MessageIdHeader",
                schema: "leadgen",
                table: "messages",
                column: "MessageIdHeader");

            migrationBuilder.CreateIndex(
                name: "IX_messages_OccurredAt",
                schema: "leadgen",
                table: "messages",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_messages_TenantId",
                schema: "leadgen",
                table: "messages",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_messages_TenantId_MailboxId_ProviderMessageId",
                schema: "leadgen",
                table: "messages",
                columns: new[] { "TenantId", "MailboxId", "ProviderMessageId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [ProviderMessageId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_messages_ThreadId",
                schema: "leadgen",
                table: "messages",
                column: "ThreadId");

            migrationBuilder.CreateIndex(
                name: "IX_profiles_TenantId",
                schema: "leadgen",
                table: "profiles",
                column: "TenantId",
                unique: true,
                filter: "[TenantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_prospect_contacts_ProspectId",
                schema: "leadgen",
                table: "prospect_contacts",
                column: "ProspectId");

            migrationBuilder.CreateIndex(
                name: "IX_prospect_contacts_TenantId",
                schema: "leadgen",
                table: "prospect_contacts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_prospects_Domain",
                schema: "leadgen",
                table: "prospects",
                column: "Domain");

            migrationBuilder.CreateIndex(
                name: "IX_prospects_Email",
                schema: "leadgen",
                table: "prospects",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_prospects_NameKey_Region",
                schema: "leadgen",
                table: "prospects",
                columns: new[] { "NameKey", "Region" });

            migrationBuilder.CreateIndex(
                name: "IX_prospects_OwnerUserId",
                schema: "leadgen",
                table: "prospects",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_prospects_PhoneE164",
                schema: "leadgen",
                table: "prospects",
                column: "PhoneE164");

            migrationBuilder.CreateIndex(
                name: "IX_prospects_SearchJobId",
                schema: "leadgen",
                table: "prospects",
                column: "SearchJobId");

            migrationBuilder.CreateIndex(
                name: "IX_prospects_Status",
                schema: "leadgen",
                table: "prospects",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_prospects_TenantId",
                schema: "leadgen",
                table: "prospects",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_prospects_TenantId_GooglePlaceId",
                schema: "leadgen",
                table: "prospects",
                columns: new[] { "TenantId", "GooglePlaceId" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0 AND [GooglePlaceId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_searches_CreatedAt",
                schema: "leadgen",
                table: "searches",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_searches_Status",
                schema: "leadgen",
                table: "searches",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_searches_TenantId",
                schema: "leadgen",
                table: "searches",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_suppressions_TenantId",
                schema: "leadgen",
                table: "suppressions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_suppressions_TenantId_Kind_Value",
                schema: "leadgen",
                table: "suppressions",
                columns: new[] { "TenantId", "Kind", "Value" },
                unique: true,
                filter: "[TenantId] IS NOT NULL AND [IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_threads_LastMessageAt",
                schema: "leadgen",
                table: "threads",
                column: "LastMessageAt");

            migrationBuilder.CreateIndex(
                name: "IX_threads_MailboxId_Counterparty",
                schema: "leadgen",
                table: "threads",
                columns: new[] { "MailboxId", "Counterparty" });

            migrationBuilder.CreateIndex(
                name: "IX_threads_ProviderThreadId",
                schema: "leadgen",
                table: "threads",
                column: "ProviderThreadId");

            migrationBuilder.CreateIndex(
                name: "IX_threads_TenantId",
                schema: "leadgen",
                table: "threads",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "business_directory",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "campaign_recipients",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "campaign_steps",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "credit_ledger",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "credit_packs",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "credit_purchases",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "credit_wallets",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "global_suppressions",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "mailboxes",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "messages",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "platform_settings",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "profiles",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "prospect_contacts",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "searches",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "suppressions",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "threads",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "campaigns",
                schema: "leadgen");

            migrationBuilder.DropTable(
                name: "prospects",
                schema: "leadgen");
        }
    }
}
