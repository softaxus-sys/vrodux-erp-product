using System.Text;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Middleware;
using Softaxis.Inventory.Infrastructure.Extensions;

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

    // ── MediatR + Pipeline Behaviors ─────────────
    builder.Services.AddMediatR(cfg =>
    {
        cfg.RegisterServicesFromAssemblies(
            typeof(Softaxis.Inventory.Application.Products.Commands.CreateProduct.CreateProductCommand).Assembly);
        cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
    });

    // ── Infrastructure ───────────────────────────
    builder.Services.AddInventoryInfrastructure(builder.Configuration);

    // ── JWT Authentication ────────────────────────
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

    if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Docker"))
        await app.Services.MigrateAndSeedInventoryAsync();

    app.UseMiddleware<ExceptionHandlingMiddleware>();
    app.UseSerilogRequestLogging();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
        app.MapScalarApiReference(opts =>
        {
            opts.Title = "Softaxis Inventory API";
            opts.Theme = ScalarTheme.DeepSpace;
        });
    }

    app.UseCors("AllowAll");
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();
    app.MapGet("/health", () => Results.Ok(new { Status = "Healthy", Service = "Inventory.API" }));

    Log.Information("Starting Softaxis.Inventory.API on {Environment}", app.Environment.EnvironmentName);
    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Inventory.API terminated unexpectedly.");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
