using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.Extensions.Options;
using Softaxis.Finance.Application.UaeVat;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.UaeVat;

/// <summary>
/// Configuration section <c>UaeVat</c>. Secrets come from environment variables
/// (<c>UaeVat__Sandbox__ClientSecret</c> …), never from committed appsettings.
/// </summary>
public sealed class UaeVatOptions
{
    public const string Section = "UaeVat";

    /// <summary>"sandbox" (default) or "production".</summary>
    public string Environment { get; set; } = "sandbox";

    /// <summary>
    /// Must be explicitly true for a production gateway to be used. A deployment configured for
    /// production but without this flag is treated as unavailable, so a sandbox test run can
    /// never reach the live tax authority by a mis-set environment name.
    /// </summary>
    public bool AllowProduction { get; set; }

    public UaeVatEndpointOptions Sandbox    { get; set; } = new();
    public UaeVatEndpointOptions Production { get; set; } = new();

    public int TimeoutSeconds { get; set; } = 60;

    /// <summary>Vendor TRN issued by FTA at software accreditation (printed into the return file).</summary>
    public string? VendorTrn { get; set; }
    public string SoftwareName    { get; set; } = "Vrodux ERP";
    public string SoftwareVersion { get; set; } = "1.0";

    public UaeVatEndpointOptions Active =>
        string.Equals(Environment, "production", StringComparison.OrdinalIgnoreCase) ? Production : Sandbox;

    public string NormalisedEnvironment =>
        string.Equals(Environment, "production", StringComparison.OrdinalIgnoreCase) ? "production" : "sandbox";
}

public sealed class UaeVatEndpointOptions
{
    public string? BaseUrl      { get; set; }
    public string? ClientId     { get; set; }
    public string? ClientSecret { get; set; }
}

/// <summary>
/// The default gateway: transmits nothing and says why.
///
/// <para>Verified 2026-10 against FTA's "Requirement document for Tax Accounting Software": FTA
/// describes uploading a VAT return file to ITAS directly from accredited software ("Option 2")
/// but states it is "not an immediate need" and will be communicated to vendors when required.
/// No endpoint, payload schema, authentication flow or sandbox is published, and none was found in
/// this repository. Inventing one would produce requests to an unknown host and statuses that look
/// like filings but are not — so this gateway never claims a submission.</para>
///
/// <para>When FTA (or an authorised provider) issues an API with documentation and credentials,
/// implement <see cref="IUaeVatSubmissionGateway"/> against it — token handling, TLS, timeouts and
/// the idempotency key already flow through the request — and register it in place of this one.
/// Even a configured <c>BaseUrl</c> does not switch this class on: an endpoint without a verified
/// protocol is still not a protocol.</para>
/// </summary>
internal sealed class UnavailableUaeVatSubmissionGateway(IOptionsSnapshot<UaeVatOptions> options) : IUaeVatSubmissionGateway
{
    private readonly UaeVatOptions _opt = options.Value;

    public string Environment => _opt.NormalisedEnvironment;

    public bool IsAvailable => false;

    public string? UnavailableReason =>
        Environment == "production" && !_opt.AllowProduction
            ? "Production submission is blocked: UaeVat__AllowProduction is not set."
            : "FTA has not published a direct VAT-return submission API or sandbox for accounting software " +
              "(their software requirements list it as a future option). Download the return file and audit " +
              "file, file on EmaraTax, then record the EmaraTax reference here.";

    public Task<UaeVatSubmissionResult> SubmitAsync(UaeVatSubmissionRequest request, CancellationToken ct) =>
        Task.FromResult(new UaeVatSubmissionResult(VatAttemptOutcome.NotAvailable, null, null, UnavailableReason));
}

internal sealed class UaeVatProfileConfiguration : IEntityTypeConfiguration<UaeVatProfile>
{
    public void Configure(EntityTypeBuilder<UaeVatProfile> b)
    {
        b.ToTable("uae_vat_profiles");
        b.HasKey(x => x.Id);
        b.Property(x => x.Trn).HasMaxLength(15).IsRequired();
        b.Property(x => x.NameEn).HasMaxLength(100).IsRequired();
        b.Property(x => x.NameAr).HasMaxLength(100);
        b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.DefaultEmirate).HasMaxLength(3).IsRequired();
        b.Property(x => x.TaxAgencyName).HasMaxLength(100);
        b.Property(x => x.Tan).HasMaxLength(20);
        b.Property(x => x.TaxAgentName).HasMaxLength(100);
        b.Property(x => x.Taan).HasMaxLength(20);
    }
}

internal sealed class VatReturnConfiguration : IEntityTypeConfiguration<VatReturn>
{
    public void Configure(EntityTypeBuilder<VatReturn> b)
    {
        b.ToTable("vat_returns");
        b.HasKey(x => x.Id);
        b.Property(x => x.PeriodLabel).HasMaxLength(50).IsRequired();
        b.Property(x => x.FromDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.ToDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.Trn).HasMaxLength(15);
        b.Property(x => x.OutputVat).HasPrecision(18, 2);
        b.Property(x => x.InputVat).HasPrecision(18, 2);
        b.Property(x => x.NetVat).HasPrecision(18, 2);
        b.Property(x => x.ContentHash).HasMaxLength(64);
        b.Property(x => x.IdempotencyKey).HasMaxLength(64);
        b.Property(x => x.PreparedByName).HasMaxLength(200);
        b.Property(x => x.ApprovedByUserId).HasMaxLength(100);
        b.Property(x => x.ApprovedByName).HasMaxLength(200);
        b.Property(x => x.Environment).HasMaxLength(20);
        b.Property(x => x.SubmissionReference).HasMaxLength(100);
        b.Property(x => x.RejectionReason).HasMaxLength(2000);
        b.Property(x => x.FiledByName).HasMaxLength(200);
        b.HasIndex(x => x.TaxPeriodId);
        b.Ignore(x => x.CanReprepare);
        b.HasMany(x => x.Attempts).WithOne().HasForeignKey(x => x.VatReturnId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class VatReturnAttemptConfiguration : IEntityTypeConfiguration<VatReturnAttempt>
{
    public void Configure(EntityTypeBuilder<VatReturnAttempt> b)
    {
        b.ToTable("vat_return_attempts");
        b.HasKey(x => x.Id);
        b.Property(x => x.Environment).HasMaxLength(20).IsRequired();
        b.Property(x => x.IdempotencyKey).HasMaxLength(64).IsRequired();
        b.Property(x => x.ContentHash).HasMaxLength(64);
        b.Property(x => x.StartedByName).HasMaxLength(200);
        b.Property(x => x.Outcome).HasMaxLength(30).IsRequired();
        b.Property(x => x.ExternalReference).HasMaxLength(100);
        b.Property(x => x.Message).HasMaxLength(2000);
        // At most one in-flight attempt per return, enforced by the database — the in-memory check
        // in VatReturn.BeginAttempt cannot see a second request racing the first.
        b.HasIndex(x => x.VatReturnId).IsUnique().HasFilter("[Outcome] = 'in_progress'")
            .HasDatabaseName("IX_vat_return_attempts_one_in_flight");
    }
}
