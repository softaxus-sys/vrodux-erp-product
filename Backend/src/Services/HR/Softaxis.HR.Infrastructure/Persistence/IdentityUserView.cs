using Microsoft.EntityFrameworkCore;

namespace Softaxis.HR.Infrastructure.Persistence;

/// <summary>
/// Read-only projection of Identity's users table, so HR can show the login account linked to an
/// employee without copying any of it.
///
/// <para><b>One direction only: HR reads Identity, Identity never reads HR.</b> Identity is the
/// base module every tenant has, so the dependency always points at something guaranteed present.
/// Mirrors CRM's <c>IdentityTeamView</c> — same physical database, different schema, mapped with
/// <c>ToView</c> so EF never tries to scaffold or migrate it. Identity owns this schema.</para>
///
/// <para>Deliberately in <c>Softaxis.HR.Infrastructure</c>, not <c>.Domain</c> —
/// <c>TenantIsolation.ApplyTenantId</c> filters by that namespace prefix, so this type is left out
/// of the shadow-TenantId mechanism and carries Identity's own <c>TenantId</c> column instead.
/// Queries against it must therefore filter the tenant by hand.</para>
/// </summary>
internal sealed class IdentityUserView
{
    public Guid      Id            { get; set; }
    public string    Email         { get; set; } = string.Empty;
    public string    Username      { get; set; } = string.Empty;
    public string    FirstName     { get; set; } = string.Empty;
    public string    LastName      { get; set; } = string.Empty;
    public string    Status        { get; set; } = string.Empty;
    public bool      EmailVerified { get; set; }
    public DateTime? LastLoginAt   { get; set; }
    public Guid?     TenantId      { get; set; }
    public bool      IsDeleted     { get; set; }
}

internal static class IdentityUserViewMapping
{
    public static void MapIdentityUserView(this ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<IdentityUserView>(b =>
        {
            b.HasNoKey();
            b.ToView("users", "identity");
            // Identity maps Email through a value converter onto a lower-case "email" column.
            b.Property(x => x.Email).HasColumnName("email");
        });
    }
}
