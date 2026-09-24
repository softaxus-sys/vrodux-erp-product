using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Sync;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.DataProtection;
using Scalar.AspNetCore;
using Serilog;
using Softaxis.ApiGateway.Middleware;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Middleware;
using Softaxis.Identity.API.Extensions;
using Softaxis.Identity.API.Middleware;
using Softaxis.Identity.Infrastructure.Extensions;
using Softaxis.Identity.Infrastructure.Services;
using Softaxis.Inventory.Infrastructure.Extensions;
using Softaxis.Purchase.Infrastructure.Extensions;
using Softaxis.Sales.API.Extensions;
using Softaxis.Sales.Infrastructure.Extensions;
using Softaxis.POS.Infrastructure.Extensions;
using Softaxis.HR.Infrastructure.Extensions;
using Softaxis.Finance.Infrastructure.Extensions;
using Softaxis.CRM.Infrastructure.Extensions;
using Softaxis.Construction.Infrastructure.Extensions;
using Softaxis.RealEstate.Infrastructure.Extensions;
using Softaxis.Hospitality.Infrastructure.Extensions;
using Softaxis.Restaurant.Infrastructure.Extensions;
using Softaxis.Recipe.Infrastructure.Extensions;
using Softaxis.ProjectManagement.Infrastructure.Extensions;
using Softaxis.AiAssistant.Infrastructure.Extensions;
using Softaxis.VisaServices.Infrastructure.Extensions;
using Softaxis.Support.Infrastructure.Extensions;
using Softaxis.Seo.Infrastructure.Extensions;
using Softaxis.BuildingBlocks.Application.Serialization;
using Softaxis.BuildingBlocks.Infrastructure.Notifications;

// ── Bootstrap Serilog ─────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // ── Windows Service support (no-op when run as console) ──────────────────
    builder.Host.UseWindowsService();

    // ── Kestrel request-line limit ────────────────────────────────────────────
    // A browser cannot set an Authorization header on a WebSocket upgrade, so SignalR
    // puts the JWT in the query string: GET /hubs/notifications?id=...&access_token=<jwt>.
    // An Administrator's token carries every seeded permission as its own claim (336 keys,
    // ~12 KB once base64'd), which overruns Kestrel's 8 KB default MaxRequestLineSize and
    // is rejected with 414 URI Too Long — so the notifications hub never connects for an
    // admin. The negotiate POST succeeds (it uses a real header), which is why this fails
    // silently rather than loudly: the client reports a healthy start and delivers nothing.
    //
    // 64 KB leaves room for the permission set to keep growing — it has grown with almost
    // every module — without this resurfacing. It only relaxes the URL length Kestrel will
    // parse; it grants no additional access, and MaxRequestHeadersTotalSize is untouched.
    builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestLineSize = 64 * 1024);

    // ── Serilog ───────────────────────────────────────────────────────────────
    // Single-file publish strips assembly metadata — tell Serilog where to find sinks explicitly
    var serilogAssemblies = new[]
    {
        typeof(Serilog.ConsoleLoggerConfigurationExtensions).Assembly,
        typeof(Serilog.SerilogHostBuilderExtensions).Assembly,
        System.Reflection.Assembly.Load("Serilog.Enrichers.Environment"),
    };
    var readerOptions = new Serilog.Settings.Configuration.ConfigurationReaderOptions(serilogAssemblies);
    builder.Host.UseSerilog((ctx, cfg) => cfg
        .ReadFrom.Configuration(ctx.Configuration, readerOptions)
        .Enrich.FromLogContext()
        .Enrich.WithMachineName());

    // ── MediatR — register every application assembly that has handlers ───────
    // Note: Sales.Application and Purchase.Application are empty stubs — add
    //       their anchor types here once the first handler is implemented.
    builder.Services.AddMediatR(cfg =>
    {
        cfg.RegisterServicesFromAssemblies(
            typeof(Softaxis.Identity.Application.Auth.Commands.Login.LoginCommand).Assembly,
            // Identity.Infrastructure carries the billing webhook handlers — they need the Stripe
            // SDK, which has no business being referenced from the Application layer.
            typeof(Softaxis.Identity.Infrastructure.Persistence.IdentityDbContext).Assembly,
            typeof(Softaxis.POS.Application.Products.Commands.CreateProduct.CreateProductCommand).Assembly,
            typeof(Softaxis.Inventory.Application.Categories.Queries.GetCategories.GetCategoriesQuery).Assembly);
        cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
        cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
    });

    // ── FluentValidation — scan all application assemblies that contain validators
    builder.Services.AddValidatorsFromAssemblies([
        typeof(Softaxis.Identity.Application.Auth.Commands.Login.LoginCommandValidator).Assembly,
        typeof(Softaxis.POS.Application.Products.Commands.CreateProduct.CreateProductCommand).Assembly,
    ]);

    // ── Infrastructure — all 5 services ──────────────────────────────────────
    // Identity: registers DbContext, repos, JWT auth, BCrypt, JwtSettings
    builder.Services.AddIdentityInfrastructure(builder.Configuration);
    // POS: registers DbContext, repos, ReportService
    builder.Services.AddPOSInfrastructure(builder.Configuration);
    // POS options (these live in POS.API's Program.cs which does NOT run under the
    // gateway host, so bind them here too — printer + discount settings).
    builder.Services.Configure<Softaxis.POS.API.Controllers.PrinterSettings>(
        builder.Configuration.GetSection("PrinterSettings"));
    builder.Services.Configure<Softaxis.POS.Application.Abstractions.DiscountSettings>(
        builder.Configuration.GetSection("DiscountSettings"));
    // AI event bus fallback (M4b): a no-op so producers can always inject IAiEventBus. The AI Assistant
    // service registers the real durable-inbox implementation later (last registration wins).
    builder.Services.AddScoped<Softaxis.BuildingBlocks.Application.AiEvents.IAiEventBus,
                               Softaxis.BuildingBlocks.Application.AiEvents.NullAiEventBus>();
    // Simple services: just DbContext registration
    builder.Services.AddInventoryInfrastructure(builder.Configuration);
    builder.Services.AddSalesInfrastructure(builder.Configuration);
    builder.Services.AddPurchaseInfrastructure(builder.Configuration);
    builder.Services.AddHrInfrastructure(builder.Configuration);
    builder.Services.AddFinanceInfrastructure(builder.Configuration);
    builder.Services.AddCrmInfrastructure(builder.Configuration);
    builder.Services.AddConstructionInfrastructure(builder.Configuration);
    builder.Services.AddRealEstateInfrastructure(builder.Configuration);
    builder.Services.AddHospitalityInfrastructure(builder.Configuration);
    builder.Services.AddRestaurantInfrastructure(builder.Configuration);
    builder.Services.AddRecipeInfrastructure(builder.Configuration);
    builder.Services.AddProjectManagementInfrastructure(builder.Configuration);
    // AI Assistant: DbContext, provider abstraction (Claude/Groq), orchestrator, tools
    builder.Services.AddAiAssistantInfrastructure(builder.Configuration);
    builder.Services.AddVisaServicesInfrastructure(builder.Configuration);
    builder.Services.AddSupportInfrastructure(builder.Configuration);
    builder.Services.AddSeoInfrastructure(builder.Configuration);

    // ── In-memory cache (used by SubscriptionEnforcementMiddleware) ──────────
    builder.Services.AddMemoryCache();

    // ── Background-job tenant filter ─────────────────────────────────────────
    //    Registered AFTER every Add*Infrastructure above, so this replaces the
    //    permissive fallback each service registers for its own standalone host.
    //    Keeps hosted services from running twice over a workspace that exists
    //    both on-premises and as a cloud mirror. docs/on-premises-cloud-mirror.md
    builder.Services.AddSingleton<ITenantWorkFilter, MirrorAwareTenantWorkFilter>();

    // The real cloud-sync alerter, replacing BuildingBlocks' silent default. Registered here
    // because it needs email and the notification store. Scoped: it resolves per-request services.
    builder.Services.AddScoped<Softaxis.BuildingBlocks.Application.Sync.ISyncAlerter, Softaxis.ApiGateway.Sync.SyncAlerter>();

    // ── Data Protection — encrypts integration secrets (OAuth tokens, API keys, ──
    //    webhook signing secrets). Keys are persisted so encrypted values survive
    //    restarts; a fixed application name keeps the ring stable across hosts.
    var dpKeyPath = builder.Configuration["DataProtection:KeyPath"]
        ?? Path.Combine(builder.Environment.ContentRootPath, "App_Data", "dp-keys");
    Directory.CreateDirectory(dpKeyPath);
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(dpKeyPath))
        .SetApplicationName("Softaxis.ERP");

    // ── HTTP Context ──────────────────────────────────────────────────────────
    builder.Services.AddHttpContextAccessor();

    // ── ICurrentUser — two separate interfaces, two implementations ───────────
    // Identity.Application.Abstractions.ICurrentUser  →  Identity CurrentUserService
    builder.Services.AddScoped<
        Softaxis.Identity.Application.Abstractions.ICurrentUser,
        Softaxis.Identity.API.Middleware.CurrentUserService>();

    // POS.Application.Abstractions.ICurrentUser  →  POS CurrentUserService
    builder.Services.AddScoped<
        Softaxis.POS.Application.Abstractions.ICurrentUser,
        Softaxis.POS.API.Middleware.CurrentUserService>();

    // ProjectManagement.Application.Abstractions.ICurrentUser  →  ProjectManagement CurrentUserService
    builder.Services.AddScoped<
        Softaxis.ProjectManagement.Application.Abstractions.ICurrentUser,
        Softaxis.ProjectManagement.API.Middleware.CurrentUserService>();

    // AiAssistant.Application.Abstractions.ICurrentUser  →  AiAssistant CurrentUserService
    builder.Services.AddScoped<
        Softaxis.AiAssistant.Application.Abstractions.ICurrentUser,
        Softaxis.AiAssistant.API.Middleware.CurrentUserService>();

    // CRM.Application.Abstractions.ICurrentUser  →  CRM CurrentUserService (lead access scoping)
    builder.Services.AddScoped<
        Softaxis.CRM.Application.Abstractions.ICurrentUser,
        Softaxis.CRM.API.Middleware.CurrentUserService>();

    // HR.Application.Abstractions.ICurrentUser  →  HR CurrentUserService (employee self-service)
    builder.Services.AddScoped<
        Softaxis.HR.Application.Abstractions.ICurrentUser,
        Softaxis.HR.API.Middleware.CurrentUserService>();

    // Restaurant.Application.Abstractions.ICurrentUser  →  Restaurant CurrentUserService (cashier stamping)
    builder.Services.AddScoped<
        Softaxis.Restaurant.Application.Abstractions.ICurrentUser,
        Softaxis.Restaurant.API.Middleware.CurrentUserService>();

    // Restaurant.Application.Abstractions.IRestaurantRealtimeNotifier  →  SignalR push (KDS/table board)
    builder.Services.AddScoped<
        Softaxis.Restaurant.Application.Abstractions.IRestaurantRealtimeNotifier,
        Softaxis.Restaurant.API.Realtime.SignalRRestaurantNotifier>();
    builder.Services.AddSignalR();

    // ── Platform-wide notifications ──────────────────────────────────────────
    // The shared store + publisher every module raises alerts through (BuildingBlocks), plus the
    // SignalR channel that delivers them. The realtime notifier is registered HERE rather than in
    // BuildingBlocks so BuildingBlocks keeps no SignalR reference and every service can depend on it.
    builder.Services.AddNotifications(builder.Configuration);

    // ── On-premises → cloud mirror: change capture ───────────────────────────
    //    Registration only; nothing touches the database until the startup step
    //    below, which no-ops unless this installation is configured to mirror.
    builder.Services.AddCloudMirrorCapture(builder.Configuration);
    builder.Services.AddScoped<
        Softaxis.BuildingBlocks.Application.Notifications.INotificationRealtimeNotifier,
        Softaxis.ApiGateway.Notifications.SignalRNotificationNotifier>();

    // Support.Application.Abstractions.ICurrentUser  →  Support CurrentUserService (cross-tenant
    // ticket access — the one ICurrentUser in this codebase that also surfaces the caller's OWN
    // tenant id/name, since Support tickets are not ambient-tenant-scoped like every other module)
    builder.Services.AddScoped<
        Softaxis.Support.Application.Abstractions.ICurrentUser,
        Softaxis.Support.API.Middleware.CurrentUserService>();

    // Support.Application.Abstractions.ISupportRealtimeNotifier  →  SignalR push, group-targeted
    // (never broadcast — see the interface's own remarks on why this differs from Restaurant's).
    builder.Services.AddScoped<
        Softaxis.Support.Application.Abstractions.ISupportRealtimeNotifier,
        Softaxis.Support.API.Realtime.SignalRSupportNotifier>();

    // Seo.Application.Abstractions.ICurrentUser  →  Seo CurrentUserService
    builder.Services.AddScoped<
        Softaxis.Seo.Application.Abstractions.ICurrentUser,
        Softaxis.Seo.API.Middleware.CurrentUserService>();

    // ── Controllers — pull controllers from all 5 API assemblies ─────────────
    builder.Services.AddControllers()
        .AddApplicationPart(typeof(Softaxis.Identity.API.Controllers.AuthController).Assembly)
        .AddApplicationPart(typeof(Softaxis.POS.API.Controllers.ProductsController).Assembly)
        .AddApplicationPart(typeof(Softaxis.Inventory.API.Controllers.ProductsController).Assembly)
        .AddApplicationPart(typeof(Softaxis.Sales.API.Controllers.SalesOrdersController).Assembly)
        .AddApplicationPart(typeof(Softaxis.Purchase.API.Controllers.VendorsController).Assembly)
        .AddApplicationPart(typeof(Softaxis.HR.API.Controllers.DepartmentsController).Assembly)
        .AddApplicationPart(typeof(Softaxis.Finance.API.Controllers.AccountsController).Assembly)
        .AddApplicationPart(typeof(Softaxis.CRM.API.Controllers.LeadsController).Assembly)
        .AddApplicationPart(typeof(Softaxis.Construction.API.Controllers.ProjectsController).Assembly)
        .AddApplicationPart(typeof(Softaxis.RealEstate.API.Controllers.PropertiesController).Assembly)
        .AddApplicationPart(typeof(Softaxis.Hospitality.API.Controllers.RoomsController).Assembly)
        .AddApplicationPart(typeof(Softaxis.Restaurant.API.Controllers.TablesController).Assembly)
        .AddApplicationPart(typeof(Softaxis.Recipe.API.Controllers.RecipesController).Assembly)
        .AddApplicationPart(typeof(Softaxis.ProjectManagement.API.Controllers.ProjectsController).Assembly)
        .AddApplicationPart(typeof(Softaxis.AiAssistant.API.Controllers.AiChatController).Assembly)
        .AddApplicationPart(typeof(Softaxis.VisaServices.API.Controllers.VisaCasesController).Assembly)
        .AddApplicationPart(typeof(Softaxis.Support.API.Controllers.SupportTicketsController).Assembly)
        .AddApplicationPart(typeof(Softaxis.Seo.API.Controllers.SeoSitesController).Assembly)
        .AddJsonOptions(o =>
        {
            // Emit every DateTime as an explicit UTC instant ("…Z").
            //
            // Instants are persisted as DateTime.UtcNow, but SQL Server datetime2 carries no
            // offset, so EF returns them as DateTimeKind.Unspecified and System.Text.Json wrote
            // them with NO zone designator. The browser parses a zone-less date-TIME as LOCAL, so
            // every timestamp in the product was displayed shifted by the viewer's UTC offset.
            //
            // Calendar dates (batch expiry, voucher validity) opt out per-property with
            // [JsonConverter(typeof(NullableCalendarDateJsonConverter))] — a property-level
            // converter takes precedence over these.
            o.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter());
            o.JsonSerializerOptions.Converters.Add(new NullableUtcDateTimeConverter());
        });

    // ── Authorization + OpenAPI ───────────────────────────────────────────────
    builder.Services.AddAuthorization();
    builder.Services.AddOpenApi();

    // ── Rate limiting ─────────────────────────────────────────────────────────
    // The anonymous auth endpoints carry [EnableRateLimiting] attributes, and this host serves
    // them via AddApplicationPart. Without the limiter registered here those attributes did
    // nothing at all in the deployed product.
    builder.Services.AddAuthRateLimiting();
    // Sales' anonymous quotation link carries its own [EnableRateLimiting] attribute, and a
    // named policy that is never registered throws at request time.
    builder.Services.AddPublicLinkRateLimiting();
    // Real Estate's website listings API (API-key authenticated).
    Softaxis.RealEstate.API.Extensions.WebsiteRateLimitPolicies.AddWebsiteApiRateLimiting(builder.Services);

    // ── CORS ──────────────────────────────────────────────────────────────────
    builder.Services.AddCors(opts =>
    {
        opts.AddPolicy("AllowFrontend", p => p
            .WithOrigins(
                builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
                ?? ["http://localhost:3000"])
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());

        // Public inbound lead endpoints (webhooks / hosted form / website snippet) must be
        // callable from any origin — a tenant embeds them on their own website. Anonymous +
        // unguessable-key protected, so any-origin is safe (no credentials).
        opts.AddPolicy("PublicWebhook", p => p
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());

        // A tenant's own public website reads its published property listings from a different
        // origin (and, once live, from visitors' browsers all over the world). Read-only,
        // anonymous, and scoped to one tenant by the slug in the URL — so any-origin is correct
        // here too. No credentials, deliberately: nothing behind this policy should ever be
        // reachable with a session cookie attached.
        opts.AddPolicy("PublicSite", p => p
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .WithMethods("GET"));
    });

    // ─────────────────────────────────────────────────────────────────────────
    var app = builder.Build();

    // Every emailed link — password reset, email verification, employee invite — is built from
    // FrontendUrl. The shipped default is a dev Vite port, so an install that never overrides it
    // sends links nobody outside the server can open, and the only symptom is users reporting that
    // password reset "does not work". Say so at startup rather than letting it fail silently.
    // Password resets, verification and invites all depend on SMTP. Host and username live in
    // appsettings.json while the password is supplied per environment, so a host started without
    // that environment file looks configured and fails at authentication on every send — with the
    // failure caught and logged, and nothing at all on screen. Say which piece is missing, once,
    // at startup, where it is actually findable.
    {
        // Counts a placeholder ("__SET_SMTP_PASSWORD_VIA_ENV_OR_DEV_SETTINGS__") as missing, which is
        // the case that actually bites: the value is present, so an empty-check passes, and every
        // send then fails authentication.
        var missing = SmtpConfiguration.MissingKeys(app.Configuration);

        if (missing.Length == 3)
            Log.Warning("Email is not configured — password reset, verification and invite links will " +
                        "be written to this log instead of being sent. Environment: {Environment}.",
                        app.Environment.EnvironmentName);
        else if (missing.Length > 0)
            Log.Warning("Email is only PARTLY configured — missing {Missing}. No mail can be sent. " +
                        "Environment is {Environment}; check the appsettings file for it, or set the " +
                        "Email__{First} environment variable.",
                        string.Join(", ", missing), app.Environment.EnvironmentName, missing[0]);
    }

    if (!app.Environment.IsDevelopment())
    {
        var frontendUrl = app.Configuration["FrontendUrl"];
        if (string.IsNullOrWhiteSpace(frontendUrl)
            || frontendUrl.Contains("localhost", StringComparison.OrdinalIgnoreCase)
            || frontendUrl.Contains("127.0.0.1", StringComparison.Ordinal))
        {
            Log.Warning(
                "FrontendUrl is {FrontendUrl} — password-reset, verification and invite links will " +
                "point there and will not open for users. Set FrontendUrl in appsettings.json (or the " +
                "FrontendUrl environment variable) to the address staff actually use.",
                frontendUrl ?? "(not set)");
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Auto-migrate every DbContext on startup ──────────────────────────────
    //
    // Dev and Docker have always done this. An ON-PREMISES installation must too, and did not:
    // the published Windows service sets no ASPNETCORE_ENVIRONMENT, so it runs as Production and
    // skipped migrations entirely - leaving a freshly installed shop pointed at an empty database
    // with no tables and no clear reason why. There is no deploy pipeline on a customer's server
    // to apply them separately, so the service has to do it itself.
    //
    // Presence of a licence key is the signal: it is what makes an installation on-premises.
    // Database:MigrateOnStartup forces it on for anything else that needs it.
    var migrateOnStartup =
        app.Environment.IsDevelopment()
        || app.Environment.IsEnvironment("Docker")
        || app.Configuration.GetValue("Database:MigrateOnStartup", false)
        || !string.IsNullOrWhiteSpace(app.Configuration["OnPremises:LicenseKey"]);

    if (migrateOnStartup)
    {
        // On an on-premises box, install only what the licence covers. Null means "everything",
        // which is every cloud environment and every developer machine - see LicensedModules.
        var licensed = Softaxis.ApiGateway.Licensing.LicensedModules.Resolve(
            app.Services, app.Configuration, app.Logger);

        // Identity is unconditional: it holds the tenant and the users, and the licence itself is
        // adopted inside it.
        await app.Services.MigrateAndSeedAsync();          // Identity (+ seeds admin)

        async Task ForModule(string code, Func<Task> migrate)
        {
            if (licensed is not null && !licensed.Contains(code)) return;
            await migrate();
        }

        await ForModule("pos",                app.Services.MigrateAndSeedPOSAsync);
        await ForModule("inventory",          app.Services.MigrateAndSeedInventoryAsync);
        await ForModule("sales",              app.Services.MigrateAndSeedSalesAsync);
        await ForModule("purchase",           app.Services.MigrateAndSeedPurchaseAsync);
        await ForModule("hr",                 app.Services.MigrateAndSeedHrAsync);
        await ForModule("finance",            app.Services.MigrateAndSeedFinanceAsync);
        await ForModule("crm",                app.Services.MigrateAndSeedCrmAsync);
        await ForModule("construction",       app.Services.MigrateAndSeedConstructionAsync);
        await ForModule("real-estate",        app.Services.MigrateAndSeedRealEstateAsync);
        await ForModule("hospitality",        app.Services.MigrateAndSeedHospitalityAsync);
        await ForModule("restaurant",         app.Services.MigrateAndSeedRestaurantAsync);
        await ForModule("recipe",             app.Services.MigrateAndSeedRecipeAsync);
        await ForModule("project-management", app.Services.MigrateAndSeedProjectManagementAsync);
        await ForModule("visa",               app.Services.MigrateAndSeedVisaServicesAsync);

        // Cross-cutting, licensed to nobody in particular. The notifications backfill checks for
        // the CRM tables before reading them, so it is safe on a box with no CRM schema.
        await app.Services.MigrateAndSeedAiAssistantAsync();        // AI Assistant
        await app.Services.MigrateAndSeedSupportAsync();            // Support
        await app.Services.MigrateAndSeedSeoAsync();                // SEO AI Agent
        await app.Services.MigrateNotificationsAsync();             // Notifications (+ copies CRM history in)

        // Runs last, and only on an installation that mirrors to the cloud: enables SQL Server
        // change tracking for the tables in scope and creates the watermark table. Never throws -
        // the shop trades whether or not capture is ready. docs/on-premises-cloud-mirror.md §5
        await app.Services.PrepareChangeCaptureAsync();
    }

    // ── Middleware pipeline ───────────────────────────────────────────────────
    app.UseSerilogRequestLogging();
    app.UseMiddleware<ExceptionHandlingMiddleware>();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
        app.MapScalarApiReference(opts =>
        {
            opts.Title = "Softaxis ERP — Unified API";
            opts.Theme = ScalarTheme.DeepSpace;
            opts.DefaultHttpClient = new(ScalarTarget.CSharp, ScalarClient.HttpClient);
        });
    }

    // Swallow the fallout of a client that disconnected mid-request. The browser aborting a call
    // (reload, navigation, React StrictMode) cancels the SQL command, and SqlClient surfaces that
    // as a SqlException rather than OperationCanceledException — which would otherwise be logged
    // as a 500 and written to a socket nobody is listening on. 499 is the usual "client closed
    // request" code; nothing is actually sent, since the connection is already gone.
    app.Use(async (ctx, next) =>
    {
        try
        {
            await next();
        }
        catch (Exception) when (ctx.RequestAborted.IsCancellationRequested)
        {
            if (!ctx.Response.HasStarted) ctx.Response.StatusCode = 499;
        }
    });

    app.UseCors("AllowFrontend");
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseMiddleware<TenantContextMiddleware>();           // resolve tenant + modules from JWT
    app.UseMiddleware<TenantAmbientMiddleware>();           // publish tenant to AsyncLocal for DB isolation
    app.UseMiddleware<SubscriptionEnforcementMiddleware>(); // block expired subscriptions
    app.UseMiddleware<ModuleEnforcementMiddleware>();       // block unlicensed module routes
    app.UseAuthorization();
    app.MapControllers();
    app.MapHub<Softaxis.Restaurant.API.Realtime.RestaurantHub>("/hubs/restaurant");
    app.MapHub<Softaxis.Support.API.Realtime.SupportHub>("/hubs/support");
    app.MapHub<Softaxis.ApiGateway.Notifications.NotificationsHub>("/hubs/notifications");

    app.MapGet("/health", () => Results.Ok(new
    {
        Status  = "Healthy",
        Service = "Softaxis.ERP.Gateway",
        Time    = DateTime.UtcNow,
        Services = new[] { "Identity", "POS", "Inventory", "Sales", "Purchase", "HR", "Finance", "CRM", "Construction", "RealEstate", "Hospitality", "Restaurant", "Recipe", "ProjectManagement", "VisaServices", "Support", "Seo" }
    })).AllowAnonymous();

    Log.Information("Softaxis ERP Gateway started on {Env}", app.Environment.EnvironmentName);
    await app.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "ERP Gateway terminated unexpectedly.");
    throw;
}
finally
{
    await Log.CloseAndFlushAsync();
}
