using System.Threading.RateLimiting;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.RateLimiting;
using Scalar.AspNetCore;
using Serilog;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Middleware;
using Softaxis.Identity.API.Middleware;
// TenantContextMiddleware is in the same namespace — no additional using needed
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Infrastructure.Extensions;

// ── Serilog bootstrap logger ─────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // ── Local secrets override (not committed to git) ─────────────────────────
    // appsettings.Local.json: put the RSA private key + any machine-specific secrets here.
    // Add this file to .gitignore — never commit it.
    builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);

    // ── Optional external secrets file (outside web root, belt-and-suspenders) ─
    // C:\SoftaxisSecrets\license.json with { "License": { "RsaPrivateKeyPem": "..." } }
    var secretsFile = @"C:\SoftaxisSecrets\license.json";
    if (File.Exists(secretsFile))
        builder.Configuration.AddJsonFile(secretsFile, optional: true, reloadOnChange: false);

    // ── Serilog ───────────────────────────────────────────────────────────────
    builder.Host.UseSerilog((ctx, lc) => lc
        .ReadFrom.Configuration(ctx.Configuration)
        .Enrich.FromLogContext()
        .Enrich.WithMachineName()
        .WriteTo.Console()
        .WriteTo.Seq(ctx.Configuration["Seq:Url"] ?? "http://localhost:5341"));

    // ── MediatR + Pipeline Behaviors ─────────────────────────────────────────
    builder.Services.AddMediatR(cfg =>
    {
        cfg.RegisterServicesFromAssemblies(
            typeof(Softaxis.Identity.Application.Auth.Commands.Login.LoginCommand).Assembly,
            // Billing webhook handlers live in Infrastructure (they need the Stripe SDK).
            typeof(Softaxis.Identity.Infrastructure.Persistence.IdentityDbContext).Assembly);
        cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
        cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
    });

    // ── FluentValidation ──────────────────────────────────────────────────────
    builder.Services.AddValidatorsFromAssemblyContaining<
        Softaxis.Identity.Application.Auth.Commands.Login.LoginCommandValidator>();

    // ── Infrastructure (DB, Repos, JWT, BCrypt) ────────────────────────────
    builder.Services.AddIdentityInfrastructure(builder.Configuration);

    // ── ICurrentUser (HTTP context) ────────────────────────────────────────
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ICurrentUser, CurrentUserService>();

    // ── Controllers + OpenAPI ─────────────────────────────────────────────
    builder.Services.AddControllers();
    builder.Services.AddOpenApi();

    // ── In-memory cache (used by SubscriptionEnforcementMiddleware + TrialChallengeService) ──
    builder.Services.AddMemoryCache(opts => opts.SizeLimit = 50_000);

    // ── Rate limiting ─────────────────────────────────────────────────────
    // trial_challenge:  5 req / IP / 60 s  — prevents bulk token harvesting
    // trial_register:   3 req / IP / 300 s — stops automated sign-up abuse
    // forgot_password:  5 req / IP / 300 s — prevents email spam / enumeration
    builder.Services.AddRateLimiter(rl =>
    {
        rl.RejectionStatusCode = 429;

        rl.AddPolicy("trial_challenge", ctx =>
            RateLimitPartition.GetSlidingWindowLimiter(
                partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit          = 5,
                    Window               = TimeSpan.FromSeconds(60),
                    SegmentsPerWindow    = 6,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit           = 0,
                }));

        rl.AddPolicy("trial_register", ctx =>
            RateLimitPartition.GetSlidingWindowLimiter(
                partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit          = 3,
                    Window               = TimeSpan.FromSeconds(300),
                    SegmentsPerWindow    = 5,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit           = 0,
                }));

        rl.AddPolicy("forgot_password", ctx =>
            RateLimitPartition.GetSlidingWindowLimiter(
                partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit          = 5,
                    Window               = TimeSpan.FromSeconds(300),
                    SegmentsPerWindow    = 5,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit           = 0,
                }));
    });

    // ── CORS ──────────────────────────────────────────────────────────────
    builder.Services.AddCors(opts =>
        opts.AddDefaultPolicy(p => p
            .WithOrigins(builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? ["http://localhost:3000"])
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()));

    // Authorization policies registered inside AddIdentityInfrastructure (SuperAdminOnly etc.)

    var app = builder.Build();

    // ── Migrate DB ────────────────────────────────────────────────────────
    if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Docker"))
        await app.Services.MigrateAndSeedAsync();

    // ── Middleware pipeline ───────────────────────────────────────────────
    app.UseMiddleware<ExceptionHandlingMiddleware>();
    app.UseSerilogRequestLogging();
    app.UseCors();
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseMiddleware<TenantContextMiddleware>();           // resolve tenant claims → ITenantContext
    app.UseMiddleware<SubscriptionEnforcementMiddleware>(); // block expired subscriptions
    app.UseAuthorization();

    app.MapControllers();

    // ── Scalar API docs (dev only) ────────────────────────────────────────
    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
        app.MapScalarApiReference(opts =>
        {
            opts.Title   = "Softaxis Identity API";
            opts.Theme   = ScalarTheme.DeepSpace;
            opts.DefaultHttpClient = new(ScalarTarget.CSharp, ScalarClient.HttpClient);
        });
    }

    // ── Health endpoint ───────────────────────────────────────────────────
    app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "identity", ts = DateTime.UtcNow }))
       .AllowAnonymous();

    await app.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Identity service terminated unexpectedly.");
}
finally
{
    await Log.CloseAndFlushAsync();
}
