using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Middleware;
using Softaxis.POS.API.Controllers;
using Softaxis.POS.API.Middleware;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Infrastructure.Extensions;

// ──────────────────────────────────────────────
// Bootstrap Serilog first so startup errors are captured
// ──────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((ctx, cfg) =>
        cfg.ReadFrom.Configuration(ctx.Configuration)
           .Enrich.FromLogContext()
           .Enrich.WithMachineName());

    // ── MediatR (CQRS pipeline) ──────────────────
    builder.Services.AddMediatR(cfg =>
    {
        cfg.RegisterServicesFromAssembly(
            typeof(Softaxis.POS.Application.Products.Commands.CreateProduct.CreateProductCommand).Assembly);
        cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
        cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
    });

    // ── FluentValidation ────────────────────────
    builder.Services.AddValidatorsFromAssembly(
        typeof(Softaxis.POS.Application.Products.Commands.CreateProduct.CreateProductCommand).Assembly);

    // ── Infrastructure ───────────────────────────
    builder.Services.AddPOSInfrastructure(builder.Configuration);

    // ── Printer settings (network ESC/POS) ────────
    builder.Services.Configure<PrinterSettings>(
        builder.Configuration.GetSection("PrinterSettings"));

    // ── Discount policy ───────────────────────────
    builder.Services.Configure<Softaxis.POS.Application.Abstractions.DiscountSettings>(
        builder.Configuration.GetSection("DiscountSettings"));

    // ── HTTP Context / Current User ───────────────
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ICurrentUser, CurrentUserService>();

    // ── JWT Authentication (trusts tokens issued by Identity.API) ───
    var jwtSection = builder.Configuration.GetSection("Jwt");
    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(opts =>
        {
            opts.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer           = true,
                ValidateAudience         = true,
                ValidateLifetime         = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer              = jwtSection["Issuer"],
                ValidAudience            = jwtSection["Audience"],
                IssuerSigningKey         = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(jwtSection["Secret"]!)),
                ClockSkew = TimeSpan.Zero
            };
        });

    builder.Services.AddAuthorization();

    // ── Controllers + OpenAPI ─────────────────────
    builder.Services.AddControllers();
    builder.Services.AddOpenApi();

    // ── CORS ─────────────────────────────────────
    builder.Services.AddCors(opts =>
        opts.AddPolicy("AllowAll", p =>
            p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

    // ──────────────────────────────────────────────
    var app = builder.Build();
    // ──────────────────────────────────────────────

    // ── Auto-migrate (dev / Docker) ───────────────
    if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Docker"))
        await app.Services.MigrateAndSeedPOSAsync();

    app.UseSerilogRequestLogging();

    app.UseMiddleware<ExceptionHandlingMiddleware>();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
        app.MapScalarApiReference(opts =>
        {
            opts.Title = "Softaxis POS API";
            opts.Theme = ScalarTheme.DeepSpace;
        });
    }

    app.UseCors("AllowAll");
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();
    app.MapGet("/health", () => Results.Ok(new { Status = "Healthy", Service = "POS.API" }));

    Log.Information("Starting Softaxis.POS.API on {Environment}", app.Environment.EnvironmentName);
    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "POS.API terminated unexpectedly.");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
