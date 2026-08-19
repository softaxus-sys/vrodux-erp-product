using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.DataProtection;
using Scalar.AspNetCore;
using Serilog;
using Softaxis.ApiGateway.Middleware;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Middleware;
using Softaxis.Identity.API.Middleware;
using Softaxis.Identity.Infrastructure.Extensions;
using Softaxis.Inventory.Infrastructure.Extensions;
using Softaxis.Purchase.Infrastructure.Extensions;
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
using Softaxis.VisaServices.Infrastructure.Extensions;

// ── Bootstrap Serilog ─────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // ── Windows Service support (no-op when run as console) ──────────────────
    builder.Host.UseWindowsService();

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
    // AI event bus: no-op fallback so producers (CRM lead/customer handlers, intake
    // service) can always be constructed even though the AI Assistant module isn't
    // wired into the gateway. The real durable bus (AiAssistant) would override this.
    builder.Services.AddSingleton<
        Softaxis.BuildingBlocks.Application.AiEvents.IAiEventBus,
        Softaxis.BuildingBlocks.Application.AiEvents.NullAiEventBus>();
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
    builder.Services.AddVisaServicesInfrastructure(builder.Configuration);

    // ── In-memory cache (used by SubscriptionEnforcementMiddleware) ──────────
    builder.Services.AddMemoryCache();

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

    // CRM.Application.Abstractions.ICurrentUser  →  CRM CurrentUserService (lead access scoping)
    builder.Services.AddScoped<
        Softaxis.CRM.Application.Abstractions.ICurrentUser,
        Softaxis.CRM.API.Middleware.CurrentUserService>();

    // Restaurant.Application.Abstractions.ICurrentUser  →  Restaurant CurrentUserService (cashier stamping)
    builder.Services.AddScoped<
        Softaxis.Restaurant.Application.Abstractions.ICurrentUser,
        Softaxis.Restaurant.API.Middleware.CurrentUserService>();

    // Restaurant.Application.Abstractions.IRestaurantRealtimeNotifier  →  SignalR push (KDS/table board)
    builder.Services.AddScoped<
        Softaxis.Restaurant.Application.Abstractions.IRestaurantRealtimeNotifier,
        Softaxis.Restaurant.API.Realtime.SignalRRestaurantNotifier>();
    builder.Services.AddSignalR();

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
        .AddApplicationPart(typeof(Softaxis.VisaServices.API.Controllers.VisaCasesController).Assembly);

    // ── Authorization + OpenAPI ───────────────────────────────────────────────
    builder.Services.AddAuthorization();
    builder.Services.AddOpenApi();

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
    });

    // ─────────────────────────────────────────────────────────────────────────
    var app = builder.Build();
    // ─────────────────────────────────────────────────────────────────────────

    // ── Auto-migrate all 5 DbContexts on startup (dev / Docker) ──────────────
    if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Docker"))
    {
        await app.Services.MigrateAndSeedAsync();          // Identity (+ seeds admin)
        await app.Services.MigrateAndSeedPOSAsync();       // POS
        await app.Services.MigrateAndSeedInventoryAsync(); // Inventory
        await app.Services.MigrateAndSeedSalesAsync();     // Sales
        await app.Services.MigrateAndSeedPurchaseAsync();  // Purchase
        await app.Services.MigrateAndSeedHrAsync();        // HR
        await app.Services.MigrateAndSeedFinanceAsync();       // Finance
        await app.Services.MigrateAndSeedCrmAsync();            // CRM
        await app.Services.MigrateAndSeedConstructionAsync();   // Construction
        await app.Services.MigrateAndSeedRealEstateAsync();     // Real Estate
        await app.Services.MigrateAndSeedHospitalityAsync();    // Hospitality
        await app.Services.MigrateAndSeedRestaurantAsync();     // Restaurant POS
        await app.Services.MigrateAndSeedRecipeAsync();         // Recipe
        await app.Services.MigrateAndSeedProjectManagementAsync(); // Project Management
        await app.Services.MigrateAndSeedVisaServicesAsync();       // Visa Services
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

    app.UseCors("AllowFrontend");
    app.UseAuthentication();
    app.UseMiddleware<TenantContextMiddleware>();           // resolve tenant + modules from JWT
    app.UseMiddleware<TenantAmbientMiddleware>();           // publish tenant to AsyncLocal for DB isolation
    app.UseMiddleware<SubscriptionEnforcementMiddleware>(); // block expired subscriptions
    app.UseMiddleware<ModuleEnforcementMiddleware>();       // block unlicensed module routes
    app.UseAuthorization();
    app.MapControllers();
    app.MapHub<Softaxis.Restaurant.API.Realtime.RestaurantHub>("/hubs/restaurant");

    app.MapGet("/health", () => Results.Ok(new
    {
        Status  = "Healthy",
        Service = "Softaxis.ERP.Gateway",
        Time    = DateTime.UtcNow,
        Services = new[] { "Identity", "POS", "Inventory", "Sales", "Purchase", "HR", "Finance", "CRM", "Construction", "RealEstate", "Hospitality", "Restaurant", "Recipe", "ProjectManagement", "VisaServices" }
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
