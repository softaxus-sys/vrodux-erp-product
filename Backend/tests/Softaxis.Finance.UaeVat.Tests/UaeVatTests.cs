using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Finance.Application.UaeVat;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.UaeVat;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.UaeVat;
using Xunit;

namespace Softaxis.Finance.UaeVat.Tests;

// ALL tests here are offline. Nothing in this file contacts FTA, EmaraTax or any network host:
// gateways are in-process fakes, the database is EF InMemory. There are no real sandbox tests,
// because FTA publishes no sandbox for VAT-return submission (see UnavailableUaeVatSubmissionGateway).

internal static class Fx
{
    public const string Trn = "100123456700003";
    public static readonly DateOnly Today = new(2026, 10, 20);

    public static VatTaxpayer Taxpayer(string trn = Trn, string emirate = "DXB") =>
        new(trn, "Acme Trading LLC", "أكمي", "Dubai", emirate, null, null, null, null);

    public static VatSourceLine Sale(string no, decimal net, decimal rate = 5m, string cur = "AED", decimal fx = 1m, bool missingFx = false) =>
        new("sale", "2026-07-15", no, "Customer, Inc", "100999999900003", rate, cur, net,
            Math.Round(net * rate / 100m, 2), Math.Round(net * fx, 2), Math.Round(Math.Round(net * rate / 100m, 2) * fx, 2), missingFx);

    public static VatSourceLine Purchase(string no, decimal net, string? trn = "100888888800003", decimal rate = 5m) =>
        new("purchase", "2026-08-01", no, "Supplier LLC", trn, rate, "AED", net,
            Math.Round(net * rate / 100m, 2), net, Math.Round(net * rate / 100m, 2), false);

    public static VatReturnComputation Compute(IReadOnlyList<VatSourceLine> lines, decimal? gl, VatTaxpayer? t = null,
        string from = "2026-07-01", string to = "2026-09-30") =>
        UaeVatReturnBuilder.Compute(t ?? Taxpayer(), from, to, lines, gl, Today);
}

public class MappingAndReconciliationTests
{
    [Fact]
    public void Standard_rated_sales_land_in_the_profile_emirate_and_totals_add_up()
    {
        var lines = new[] { Fx.Sale("INV-1", 10_000m), Fx.Sale("INV-2", 2_000m), Fx.Purchase("BILL-1", 4_000m) };
        var c = Fx.Compute(lines, gl: 400m);

        var box = (string id) => c.Boxes.Single(b => b.Box == id);
        Assert.Equal(12_000m, box("1b").Amount);
        Assert.Equal(600m, box("1b").Vat);
        Assert.Equal(0m, box("1a").Amount);
        Assert.Equal(12_000m, box("8").Amount);
        Assert.Equal(600m, box("8").Vat);
        Assert.Equal(4_000m, box("9").Amount);
        Assert.Equal(200m, box("12").Vat);
        Assert.Equal(400m, box("14").Vat);
        Assert.Equal(400m, c.NetVat);
        Assert.True(c.Reconciliation.Reconciled);
        Assert.False(c.HasErrors);
    }

    [Fact]
    public void Zero_rated_sales_go_to_box_3_with_a_review_warning()
    {
        var c = Fx.Compute([Fx.Sale("EXP-1", 5_000m, rate: 0m)], gl: 0m);
        Assert.Equal(5_000m, c.Boxes.Single(b => b.Box == "3").Amount);
        Assert.Contains(c.Issues, i => i.Code == "ZeroRate.Unclassified");
    }

    [Fact]
    public void Foreign_currency_documents_are_reported_in_aed()
    {
        var c = Fx.Compute([Fx.Sale("INV-USD", 1_000m, cur: "USD", fx: 3.6725m)], gl: 183.62m);
        Assert.Equal(3_672.50m, c.Boxes.Single(b => b.Box == "1b").Amount);
        Assert.Equal(183.62m, c.NetVat); // 183.625 → ledger rounds half-to-even
        Assert.True(c.Reconciliation.Reconciled);
    }

    [Fact]
    public void Gl_difference_beyond_tolerance_is_not_reconciled()
    {
        var c = Fx.Compute([Fx.Sale("INV-1", 10_000m)], gl: 450m);
        Assert.False(c.Reconciliation.Reconciled);
        Assert.Equal(50m, c.Reconciliation.Difference);
        Assert.Contains(c.Issues, i => i.Code == "Recon.Difference");
    }

    [Fact]
    public void No_gl_postings_means_not_reconciled()
    {
        var c = Fx.Compute([Fx.Sale("INV-1", 10_000m)], gl: null);
        Assert.False(c.Reconciliation.Reconciled);
        Assert.Contains(c.Issues, i => i.Code == "Recon.NoGl");
    }
}

public class ValidationTests
{
    [Theory]
    [InlineData("100123456700003", true)]
    [InlineData("10012345670000", false)]    // 14 digits
    [InlineData("200123456700003", false)]   // wrong prefix
    [InlineData("10012345670000A", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Trn_format(string? trn, bool ok) => Assert.Equal(ok, UaeVatReturnBuilder.IsValidTrn(trn));

    [Fact]
    public void Missing_trn_is_a_blocking_error()
    {
        var c = Fx.Compute([Fx.Sale("INV-1", 100m)], 5m, Fx.Taxpayer(trn: ""));
        Assert.True(c.HasErrors);
        Assert.Contains(c.Issues, i => i.Code == "Trn.Invalid");
    }

    [Theory]
    [InlineData("2026-09-30", "2026-07-01", "Period.Reversed")]
    [InlineData("2026-13-01", "2026-12-31", "Period.InvalidDates")]
    [InlineData("2025-01-01", "2026-06-30", "Period.TooLong")]
    public void Invalid_periods_are_errors(string from, string to, string code)
    {
        var c = Fx.Compute([], 0m, from: from, to: to);
        Assert.Contains(c.Issues, i => i.Code == code && i.Severity == "error");
    }

    [Fact]
    public void Open_period_is_a_warning_not_an_error()
    {
        var c = Fx.Compute([], 0m, from: "2026-10-01", to: "2026-12-31");
        Assert.Contains(c.Issues, i => i.Code == "Period.NotEnded" && i.Severity == "warning");
    }

    [Fact]
    public void Unsupported_rate_and_missing_fx_block_the_return()
    {
        var c = Fx.Compute([Fx.Sale("INV-1", 100m, rate: 15m), Fx.Sale("INV-2", 100m, cur: "EUR", missingFx: true)], null);
        Assert.Contains(c.Issues, i => i.Code == "Rate.Unsupported" && i.Reference == "INV-1");
        Assert.Contains(c.Issues, i => i.Code == "Fx.Missing" && i.Reference == "INV-2");
        Assert.True(c.HasErrors);
    }

    [Fact]
    public void Input_vat_without_supplier_trn_is_flagged()
    {
        var c = Fx.Compute([Fx.Purchase("BILL-1", 100m, trn: null)], -5m);
        Assert.Contains(c.Issues, i => i.Code == "Supplier.TrnMissing");
    }

    [Fact]
    public void Invalid_emirate_is_an_error()
    {
        var c = Fx.Compute([], 0m, Fx.Taxpayer(emirate: "XYZ"));
        Assert.Contains(c.Issues, i => i.Code == "Emirate.Invalid");
    }
}

public class FileGenerationTests
{
    [Fact]
    public void Audit_file_follows_appendix_5_layout_and_totals()
    {
        var lines = new[] { Fx.Sale("INV-1", 1_000m), Fx.Purchase("BILL-1", 400m) };
        var faf = UaeVatReturnBuilder.BuildAuditFile(Fx.Taxpayer(), "2026-07-01", "2026-09-30", lines, "Vrodux ERP 1.0", Fx.Today);
        var rows = faf.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal("CompInfoStart", rows[0]);
        Assert.Contains(rows, r => r.Contains(",01-07-2026,30-09-2026,20-10-2026,Vrodux ERP 1.0,FAFv1.0.0"));
        Assert.Contains("PurcDataEnd,400.00,20.00,1", rows);
        Assert.Contains("SuppDataEnd,1000.00,50.00,1", rows);
        // Commas in names are removed so they cannot shift columns.
        Assert.Contains(rows, r => r.StartsWith("Customer  Inc,"));
        Assert.Contains(rows, r => r.Contains(",SR,"));
    }

    [Fact]
    public void Return_xml_is_marked_uncertified_and_carries_net_vat()
    {
        var c = Fx.Compute([Fx.Sale("INV-1", 1_000m)], 50m);
        var xml = UaeVatReturnBuilder.BuildReturnXml(Fx.Taxpayer(), "Q3-2026", "2026-07-01", "2026-09-30", c, "Vrodux ERP", "1.0", null);
        Assert.Contains("certified=\"false\"", xml);
        Assert.Contains("<NetVatPayableAED>50.00</NetVatPayableAED>", xml);
        Assert.Contains("<TRN>100123456700003</TRN>", xml);
    }

    [Fact]
    public void Hash_is_deterministic_and_content_sensitive()
    {
        Assert.Equal(UaeVatReturnBuilder.Hash("a", "b"), UaeVatReturnBuilder.Hash("a", "b"));
        Assert.NotEqual(UaeVatReturnBuilder.Hash("a", "b"), UaeVatReturnBuilder.Hash("a", "c"));
    }
}

public class WorkflowTests
{
    internal static VatReturn ReadyReturn()
    {
        var r = new VatReturn(Guid.NewGuid(), "Q3-2026", "2026-07-01", "2026-09-30");
        r.ApplyPreparation(Fx.Trn, 600, 200, 400, "[]", "[]", "{}", hasBlockingErrors: false, isReconciled: true, "tester");
        Assert.Null(r.Approve("u1", "Approver"));
        Assert.Null(r.MarkReady("faf", "xml", new string('a', 64)));
        return r;
    }

    [Fact]
    public void Errors_keep_return_in_draft_and_block_approval()
    {
        var r = new VatReturn(Guid.NewGuid(), "Q3", "2026-07-01", "2026-09-30");
        r.ApplyPreparation("", 0, 0, 0, "[]", "[]", "{}", hasBlockingErrors: true, isReconciled: false, "t");
        Assert.Equal(VatReturnStatus.Draft, r.Status);
        Assert.NotNull(r.Approve("u", "n"));
    }

    [Fact]
    public void Unreconciled_return_cannot_be_approved()
    {
        var r = new VatReturn(Guid.NewGuid(), "Q3", "2026-07-01", "2026-09-30");
        r.ApplyPreparation(Fx.Trn, 1, 0, 1, "[]", "[]", "{}", false, false, "t");
        Assert.Equal(VatReturnStatus.Validated, r.Status);
        Assert.Contains("reconcile", r.Approve("u", "n"));
    }

    [Fact]
    public void Ready_return_cannot_be_reprepared()
    {
        var r = ReadyReturn();
        Assert.Equal(VatReturnStatus.ReadyToSubmit, r.Status);
        Assert.Throws<InvalidOperationException>(() =>
            r.ApplyPreparation(Fx.Trn, 0, 0, 0, "[]", "[]", "{}", false, true, "t"));
    }

    [Fact]
    public void Second_attempt_is_refused_while_one_is_in_flight()
    {
        var r = ReadyReturn();
        var (a1, _) = r.BeginAttempt("sandbox", "u");
        var (a2, err) = r.BeginAttempt("sandbox", "u");
        Assert.NotNull(a1);
        Assert.Null(a2);
        Assert.Contains("in progress", err);
    }

    [Fact]
    public void Failed_attempt_allows_retry_with_the_same_idempotency_key()
    {
        var r = ReadyReturn();
        var (a1, _) = r.BeginAttempt("sandbox", "u");
        r.CompleteAttempt(a1!, VatAttemptOutcome.Failed, null, null, "timeout");
        Assert.Equal(VatReturnStatus.ReadyToSubmit, r.Status);

        var (a2, err) = r.BeginAttempt("sandbox", "u");
        Assert.Null(err);
        Assert.Equal(2, a2!.AttemptNumber);
        Assert.Equal(a1!.IdempotencyKey, a2.IdempotencyKey);
    }

    [Fact]
    public void Accepted_return_is_never_sent_again()
    {
        var r = ReadyReturn();
        var (a1, _) = r.BeginAttempt("sandbox", "u");
        r.CompleteAttempt(a1!, VatAttemptOutcome.Acknowledged, 200, "FTA-REF-1", "ok");
        Assert.Equal(VatReturnStatus.Acknowledged, r.Status);
        Assert.Equal("FTA-REF-1", r.SubmissionReference);
        var (a2, err) = r.BeginAttempt("sandbox", "u");
        Assert.Null(a2);
        Assert.Contains("already been submitted", err);
    }

    [Fact]
    public void Portal_filing_is_distinct_from_submission()
    {
        var r = ReadyReturn();
        Assert.NotNull(r.RecordPortalFiling("  ", "u"));
        Assert.Null(r.RecordPortalFiling("EMT-123", "u"));
        Assert.Equal(VatReturnStatus.FiledViaPortal, r.Status);
        Assert.Equal("portal", r.Environment);
        Assert.Empty(r.Attempts);
    }
}

public class GatewayAndHandlerTests : IDisposable
{
    private sealed class FakeGateway(Func<UaeVatSubmissionResult> respond, Exception? throws = null) : IUaeVatSubmissionGateway
    {
        public int Calls;
        public string Environment => "sandbox";
        public bool IsAvailable => true;
        public string? UnavailableReason => null;
        public Task<UaeVatSubmissionResult> SubmitAsync(UaeVatSubmissionRequest r, CancellationToken ct)
        {
            Calls++;
            if (throws is not null) throw throws;
            return Task.FromResult(respond());
        }
    }

    private readonly string _dbName = Guid.NewGuid().ToString();

    private FinanceDbContext Db() =>
        new(new DbContextOptionsBuilder<FinanceDbContext>().UseInMemoryDatabase(_dbName).Options);

    private static void AsTenant(Guid tenant) => TenantAmbient.Set(tenant, isSuperAdmin: false, isResolved: true, currency: "AED");

    public void Dispose() => TenantAmbient.Clear();

    private async Task<Guid> SeedReadyReturnAsync(Guid tenant)
    {
        AsTenant(tenant);
        await using var db = Db();
        var r = WorkflowTests.ReadyReturn();
        db.VatReturns.Add(r);
        await db.SaveChangesAsync();
        return r.Id;
    }

    private async Task<VatReturnDto> SubmitAsync(Guid id, IUaeVatSubmissionGateway gw)
    {
        await using var db = Db();
        var h = new SubmitVatReturnHandler(db, gw, NullLogger<SubmitVatReturnHandler>.Instance);
        var res = await h.Handle(new SubmitVatReturnCommand(id, "tester"), CancellationToken.None);
        Assert.True(res.IsSuccess, res.IsSuccess ? null : res.Error.Description);
        return res.Value;
    }

    [Fact]
    public async Task Default_gateway_sends_nothing_and_never_claims_submission()
    {
        var gw = new UnavailableUaeVatSubmissionGateway(new OptionsWrapperSnapshot(new UaeVatOptions()));
        Assert.False(gw.IsAvailable);
        var id = await SeedReadyReturnAsync(Guid.NewGuid());
        var dto = await SubmitAsync(id, gw);

        Assert.Equal(VatReturnStatus.ReadyToSubmit, dto.Status);
        Assert.Equal(VatAttemptOutcome.NotAvailable, dto.Attempts.Single().Outcome);
        Assert.Null(dto.SubmissionReference);
    }

    [Fact]
    public void Production_without_explicit_allow_is_blocked()
    {
        var gw = new UnavailableUaeVatSubmissionGateway(new OptionsWrapperSnapshot(
            new UaeVatOptions { Environment = "production", AllowProduction = false }));
        Assert.Equal("production", gw.Environment);
        Assert.Contains("AllowProduction", gw.UnavailableReason);
    }

    [Fact]
    public async Task Auth_failure_is_recorded_and_return_stays_retryable()
    {
        var id = await SeedReadyReturnAsync(Guid.NewGuid());
        var dto = await SubmitAsync(id, new FakeGateway(() => new(VatAttemptOutcome.AuthFailed, 401, null, "token expired")));
        Assert.Equal(VatReturnStatus.ReadyToSubmit, dto.Status);
        Assert.Equal(401, dto.Attempts.Single().HttpStatus);
    }

    [Fact]
    public async Task Timeout_is_recorded_as_failed_and_retry_succeeds_once()
    {
        var id = await SeedReadyReturnAsync(Guid.NewGuid());
        var dto1 = await SubmitAsync(id, new FakeGateway(() => default!, new TaskCanceledException()));
        Assert.Equal(VatAttemptOutcome.Failed, dto1.Attempts.Single().Outcome);

        var ok = new FakeGateway(() => new(VatAttemptOutcome.Submitted, 202, "SBX-42", "accepted"));
        var dto2 = await SubmitAsync(id, ok);
        Assert.Equal(VatReturnStatus.Submitted, dto2.Status);
        Assert.Equal("SBX-42", dto2.SubmissionReference);

        // A third click after success: refused, gateway not called.
        await using var db = Db();
        var again = new FakeGateway(() => new(VatAttemptOutcome.Submitted, 202, "SBX-43", null));
        var res = await new SubmitVatReturnHandler(db, again, NullLogger<SubmitVatReturnHandler>.Instance)
            .Handle(new SubmitVatReturnCommand(id), CancellationToken.None);
        Assert.False(res.IsSuccess);
        Assert.Equal(0, again.Calls);
    }

    [Fact]
    public async Task Sandbox_validation_rejection_is_surfaced()
    {
        var id = await SeedReadyReturnAsync(Guid.NewGuid());
        var dto = await SubmitAsync(id, new FakeGateway(() => new(VatAttemptOutcome.Rejected, 422, null, "Box 1b mismatch")));
        Assert.Equal(VatReturnStatus.Rejected, dto.Status);
        Assert.Equal("Box 1b mismatch", dto.RejectionReason);
    }

    [Fact]
    public async Task Another_tenant_cannot_see_or_submit_the_return()
    {
        var owner = Guid.NewGuid();
        var id = await SeedReadyReturnAsync(owner);

        AsTenant(Guid.NewGuid());
        await using (var db = Db())
        {
            var list = await new GetVatReturnsHandler(db).Handle(new GetVatReturnsQuery(), CancellationToken.None);
            Assert.Empty(list.Value);

            var gw = new FakeGateway(() => new(VatAttemptOutcome.Submitted, 202, "X", null));
            var res = await new SubmitVatReturnHandler(db, gw, NullLogger<SubmitVatReturnHandler>.Instance)
                .Handle(new SubmitVatReturnCommand(id), CancellationToken.None);
            Assert.False(res.IsSuccess);
            Assert.Equal(0, gw.Calls);
        }

        AsTenant(owner);
        await using (var db = Db())
        {
            var list = await new GetVatReturnsHandler(db).Handle(new GetVatReturnsQuery(), CancellationToken.None);
            Assert.Single(list.Value);
        }
    }

    private sealed class OptionsWrapperSnapshot(UaeVatOptions value) : IOptionsSnapshot<UaeVatOptions>
    {
        public UaeVatOptions Value => value;
        public UaeVatOptions Get(string? name) => value;
    }
}
