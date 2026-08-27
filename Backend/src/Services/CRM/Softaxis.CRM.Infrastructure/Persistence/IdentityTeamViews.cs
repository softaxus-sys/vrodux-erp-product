using Microsoft.EntityFrameworkCore;

namespace Softaxis.CRM.Infrastructure.Persistence;

/// <summary>
/// Read-only projections of Identity's team tables, so CRM can express "is this lead's owner in a
/// team I lead?" as a SQL sub-query instead of a round-trip.
///
/// <para>Identity and CRM live in the same physical database under different schemas, so this is a
/// plain cross-schema read — the same approach <c>PosSessionLedger</c> and the ProjectManagement
/// backfill already take. Mapped with <c>ToView</c> rather than <c>ToTable</c> so EF never tries to
/// scaffold or migrate them; Identity owns the schema.</para>
///
/// <para>These types deliberately live in <c>Softaxis.CRM.Infrastructure</c>, not
/// <c>Softaxis.CRM.Domain</c> — <c>TenantIsolation.ApplyTenantId</c> filters by that namespace
/// prefix, so they are automatically left out of the shadow-TenantId mechanism (they carry
/// Identity's own TenantId column instead).</para>
/// </summary>
internal sealed class IdentityTeamView
{
    public Guid   Id             { get; set; }
    public string Name           { get; set; } = string.Empty;
    public Guid?  TeamLeadUserId { get; set; }
    public Guid?  TenantId       { get; set; }
    public bool   IsActive       { get; set; }
    public bool   IsDeleted      { get; set; }
}

internal sealed class IdentityTeamMemberView
{
    public Guid TeamId { get; set; }
    public Guid UserId { get; set; }
}

/// <summary>
/// Read-only projection of Identity's users, used by the Property Finder import to answer two
/// questions before creating anything: does this agent already have a login in THIS workspace,
/// and is their email already taken somewhere on the platform?
///
/// <para>That second question needs a deliberately un-scoped read: <c>IX_users_email</c> is unique
/// platform-wide (sign-in has no workspace selector), so an address belonging to another tenant
/// blocks creation here too. Only a boolean ever leaves this class — never a name, status or
/// workspace — so nothing crosses the tenant boundary that the create endpoint would not already
/// reveal by rejecting the address.</para>
/// </summary>
internal sealed class IdentityUserView
{
    public Guid   Id        { get; set; }
    public string Email     { get; set; } = string.Empty;
    public string Username  { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName  { get; set; } = string.Empty;
    public Guid?  TenantId  { get; set; }
    public bool   IsDeleted { get; set; }
}

internal static class IdentityTeamViewMapping
{
    public static void MapIdentityTeamViews(this ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<IdentityTeamView>(b =>
        {
            b.HasNoKey();
            b.ToView("teams", "identity");
        });

        modelBuilder.Entity<IdentityTeamMemberView>(b =>
        {
            b.HasNoKey();
            b.ToView("team_members", "identity");
        });

        modelBuilder.Entity<IdentityUserView>(b =>
        {
            b.HasNoKey();
            b.ToView("users", "identity");
            // The column is lower-cased in Identity's schema; every other property matches by name.
            b.Property(x => x.Email).HasColumnName("email");
        });
    }
}
