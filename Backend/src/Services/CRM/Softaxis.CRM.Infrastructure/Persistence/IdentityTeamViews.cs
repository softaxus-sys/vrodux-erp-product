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
    }
}
