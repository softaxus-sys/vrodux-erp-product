using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Softaxis.Workflow.Domain.Entities;

namespace Softaxis.Workflow.Infrastructure.Services;

/// <summary>
/// Renders an approval or rejection record, and the full record of a request, as a PDF.
///
/// Pure .NET (QuestPDF, Community licence — the same library Finance uses for invoices), so it needs no
/// browser on the on-premises Windows Service. The PDF of a decision is rendered once, at the moment of
/// the decision, and stored with its SHA-256: what is later downloaded is the document that was issued,
/// not a fresh rendering of data that may since have been edited.
/// </summary>
internal static class DecisionPdf
{
    public static void Configure() => QuestPDF.Settings.License = LicenseType.Community;

    private const string Ink = "#0F172A", Muted = "#64748B", Line = "#E2E8F0";
    private const string Green = "#047857", GreenBg = "#ECFDF5", Red = "#B91C1C", RedBg = "#FEF2F2", Amber = "#B45309", AmberBg = "#FFFBEB";

    public sealed record Input(WfRequest Request, IReadOnlyList<WfRequestStep> Steps, IReadOnlyList<WfAttachment> Attachments,
        WfBranding.Brand Brand, string TimeZoneId, Guid? DecidedStepId);

    public static (string Name, byte[] Data, string Hash) Build(Input i)
    {
        Configure();
        var bytes = Render(i);
        return (FileName(i), bytes, Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
    }

    public static string FileName(Input i)
    {
        var step = i.DecidedStepId is { } id ? i.Steps.FirstOrDefault(s => s.Id == id) : null;
        var kind = step is null ? "Record" : step.Status == StepStatus.Rejected ? "Rejection" : "Approval";
        return Wf.Sanitise($"{kind}-{i.Request.Number}{(step is null ? "" : $"-step{step.Order}")}.pdf");
    }

    private static byte[] Render(Input i)
    {
        var r = i.Request;
        var step = i.DecidedStepId is { } id ? i.Steps.FirstOrDefault(s => s.Id == id) : null;
        var rejected = step?.Status == StepStatus.Rejected || (step is null && r.Status == RequestStatus.Rejected);
        var title = step is null ? "REQUEST RECORD" : rejected ? "REJECTION RECORD" : "APPROVAL RECORD";
        var tone = step is null ? (r.Status == RequestStatus.Approved ? Green : r.Status == RequestStatus.Rejected ? Red : Amber) : rejected ? Red : Green;
        var toneBg = tone == Green ? GreenBg : tone == Red ? RedBg : AmberBg;
        var fields = FormEngine.Parse(r.FieldsJson);
        JsonElement data;
        try { data = JsonDocument.Parse(string.IsNullOrWhiteSpace(r.DataJson) ? "{}" : r.DataJson).RootElement.Clone(); }
        catch { data = JsonDocument.Parse("{}").RootElement.Clone(); }

        return Document.Create(doc => doc.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(t => t.FontSize(9.5f).FontColor(Ink));

            page.Header().Column(h =>
            {
                h.Item().Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text(i.Brand.CompanyName).FontSize(15).Bold();
                        if (!string.IsNullOrWhiteSpace(i.Brand.Address)) c.Item().Text(i.Brand.Address).FontSize(8).FontColor(Muted);
                        if (!string.IsNullOrWhiteSpace(i.Brand.TaxNumber)) c.Item().Text($"Tax no. {i.Brand.TaxNumber}").FontSize(8).FontColor(Muted);
                    });
                    row.ConstantItem(190).AlignRight().Column(c =>
                    {
                        c.Item().AlignRight().Background(toneBg).Border(1).BorderColor(tone).PaddingVertical(4).PaddingHorizontal(10)
                            .Text(title).FontSize(11).Bold().FontColor(tone);
                        c.Item().AlignRight().PaddingTop(3).Text(r.Number).FontSize(10).Bold();
                    });
                });
                h.Item().PaddingTop(8).LineHorizontal(1).LineColor(Line);
            });

            page.Content().PaddingVertical(10).Column(col =>
            {
                col.Spacing(10);

                // Request summary
                col.Item().Table(t =>
                {
                    t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });
                    void Cell(string label, string? value)
                    {
                        t.Cell().PaddingBottom(4).Column(c =>
                        {
                            c.Item().Text(label).FontSize(7.5f).FontColor(Muted).SemiBold();
                            c.Item().Text(string.IsNullOrWhiteSpace(value) ? "—" : value);
                        });
                    }
                    Cell("Form", $"{r.FormName} (v{r.FormVersion})");
                    Cell("Title", r.Title);
                    Cell("Location", r.BaseName);
                    Cell("Business unit", r.UnitName);
                    Cell("Requested by", string.IsNullOrWhiteSpace(r.RequesterDesignation) ? r.RequesterName : $"{r.RequesterName}, {r.RequesterDesignation}");
                    Cell("Submitted", r.SubmittedAt is { } s ? Wf.Local(s, i.TimeZoneId) : "Not submitted");
                    if (r.Amount > 0) Cell("Amount", r.Amount.ToString("N2", CultureInfo.InvariantCulture));
                });

                // Decision
                if (step is not null)
                {
                    col.Item().Background(toneBg).Border(1).BorderColor(tone).Padding(10).Column(c =>
                    {
                        c.Spacing(3);
                        c.Item().Text(rejected ? "REJECTED" : "APPROVED").FontSize(13).Bold().FontColor(tone);
                        c.Item().Row(rw =>
                        {
                            rw.RelativeItem().Column(x =>
                            {
                                x.Item().Text("Name").FontSize(7.5f).FontColor(Muted).SemiBold();
                                x.Item().Text(step.DecidedByName ?? "—").Bold();
                            });
                            rw.RelativeItem().Column(x =>
                            {
                                x.Item().Text("Designation").FontSize(7.5f).FontColor(Muted).SemiBold();
                                x.Item().Text(step.DecidedByDesignation ?? step.PositionName);
                            });
                            rw.RelativeItem().Column(x =>
                            {
                                x.Item().Text("Role in this flow").FontSize(7.5f).FontColor(Muted).SemiBold();
                                x.Item().Text($"{step.PositionName} ({(step.Kind == StepKind.Review ? "review" : "approval")})");
                            });
                        });
                        c.Item().PaddingTop(2).Text("Date and time").FontSize(7.5f).FontColor(Muted).SemiBold();
                        c.Item().Text(step.DecidedAt is { } d ? Wf.Local(d, i.TimeZoneId) : "—").Bold();
                        if (!string.IsNullOrWhiteSpace(step.Comment))
                        {
                            c.Item().PaddingTop(2).Text(rejected ? "Reason for rejection" : "Comment").FontSize(7.5f).FontColor(Muted).SemiBold();
                            c.Item().Text(step.Comment);
                        }
                    });
                }
                else if (RequestStatus.IsFinal(r.Status))
                {
                    col.Item().Background(toneBg).Border(1).BorderColor(tone).Padding(10).Column(c =>
                    {
                        c.Item().Text(r.Status.ToUpperInvariant()).FontSize(13).Bold().FontColor(tone);
                        if (r.CompletedAt is { } d) c.Item().Text(Wf.Local(d, i.TimeZoneId));
                        if (!string.IsNullOrWhiteSpace(r.FinalReason)) c.Item().Text($"Reason: {r.FinalReason}");
                    });
                }

                // The form as submitted
                col.Item().Text("Request details").FontSize(11).Bold();
                col.Item().Border(1).BorderColor(Line).Padding(8).Column(c =>
                {
                    c.Spacing(5);
                    var any = false;
                    foreach (var f in fields)
                    {
                        if (f.Type == "attachment") continue;
                        if (!data.TryGetProperty(f.Key, out var v)) continue;
                        if (f.Type == "lines")
                        {
                            if (v.ValueKind != JsonValueKind.Array || v.GetArrayLength() == 0) continue;
                            any = true;
                            c.Item().Column(cc =>
                            {
                                cc.Item().Text(f.Label).FontSize(7.5f).FontColor(Muted).SemiBold();
                                cc.Item().PaddingTop(2).Table(t =>
                                {
                                    var cols = f.Columns ?? [];
                                    t.ColumnsDefinition(d => { foreach (var _ in cols) d.RelativeColumn(); });
                                    foreach (var col2 in cols)
                                        t.Cell().Background("#F1F5F9").Padding(3).Text(col2.Label).FontSize(8).SemiBold();
                                    foreach (var row in v.EnumerateArray())
                                        foreach (var col2 in cols)
                                            t.Cell().BorderBottom(0.5f).BorderColor(Line).Padding(3)
                                                .Text(Display(col2.Type, row.TryGetProperty(col2.Key, out var cv) ? cv : default)).FontSize(8.5f);
                                });
                            });
                            continue;
                        }
                        var text = Display(f.Type, v);
                        if (string.IsNullOrWhiteSpace(text)) continue;
                        any = true;
                        c.Item().Column(cc =>
                        {
                            cc.Item().Text(f.Label).FontSize(7.5f).FontColor(Muted).SemiBold();
                            cc.Item().Text(text);
                        });
                    }
                    if (!any) c.Item().Text("No details were entered.").FontColor(Muted);
                });

                if (i.Attachments.Count > 0)
                {
                    col.Item().Text("Attachments").FontSize(11).Bold();
                    foreach (var a in i.Attachments)
                        col.Item().Text($"•  {a.FileName}  ({Size(a.Size)}, uploaded by {a.UploadedByName})").FontSize(9);
                }

                // The approval chain
                col.Item().Text("Approval chain").FontSize(11).Bold();
                col.Item().Table(t =>
                {
                    t.ColumnsDefinition(c => { c.ConstantColumn(22); c.RelativeColumn(2.2f); c.RelativeColumn(2.4f); c.RelativeColumn(1.4f); c.RelativeColumn(2.2f); });
                    foreach (var h in new[] { "#", "Position", "Person", "Status", "Date and time" })
                        t.Cell().Background("#F1F5F9").Padding(4).Text(h).FontSize(8).SemiBold();
                    foreach (var s in i.Steps.OrderBy(x => x.Order))
                    {
                        var who = s.DecidedByName is not null
                            ? (string.IsNullOrWhiteSpace(s.DecidedByDesignation) ? s.DecidedByName : $"{s.DecidedByName}, {s.DecidedByDesignation}")
                            : string.Join(", ", s.Assignees.Select(a => a.Name));
                        var status = s.Status switch
                        {
                            StepStatus.Approved => "Approved", StepStatus.Rejected => "Rejected", StepStatus.Pending => "Waiting",
                            StepStatus.Skipped => "Skipped", _ => "Not reached",
                        };
                        var colour = s.Status == StepStatus.Approved ? Green : s.Status == StepStatus.Rejected ? Red : Muted;
                        var hl = step is not null && s.Id == step.Id;
                        void Body(IContainer c, string text, string? clr = null, bool bold = false)
                        {
                            var cell = c.BorderBottom(0.5f).BorderColor(Line).Padding(4);
                            if (hl) cell = cell.Background("#F8FAFC");
                            var tx = cell.Text(text).FontSize(8.5f);
                            if (clr is not null) tx.FontColor(clr);
                            if (bold) tx.Bold();
                        }
                        Body(t.Cell(), s.Order.ToString());
                        Body(t.Cell(), $"{s.PositionName}{(s.Kind == StepKind.Review ? " (review)" : "")}");
                        Body(t.Cell(), string.IsNullOrWhiteSpace(who) ? "—" : who);
                        Body(t.Cell(), status, colour, true);
                        Body(t.Cell(), s.DecidedAt is { } d ? Wf.Local(d, i.TimeZoneId) : (s.SkipReason ?? "—"));
                    }
                });
            });

            page.Footer().Column(f =>
            {
                f.Item().LineHorizontal(0.5f).LineColor(Line);
                f.Item().PaddingTop(4).Row(row =>
                {
                    row.RelativeItem().Text($"Generated by Vrodux · record {r.Id.ToString()[..8].ToUpperInvariant()} · {Wf.Local(DateTime.UtcNow, i.TimeZoneId)}")
                        .FontSize(7.5f).FontColor(Muted);
                    row.ConstantItem(80).AlignRight().Text(t =>
                    {
                        t.DefaultTextStyle(x => x.FontSize(7.5f).FontColor(Muted));
                        t.Span("Page "); t.CurrentPageNumber(); t.Span(" of "); t.TotalPages();
                    });
                });
            });
        })).GeneratePdf();
    }

    private static string Display(string type, JsonElement v)
    {
        if (v.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null) return "";
        switch (type)
        {
            case "money":
            case "number":
                return v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var n)
                    ? n.ToString(type == "money" ? "N2" : "0.##", CultureInfo.InvariantCulture) : v.ToString();
            case "date":
                return DateTime.TryParseExact(v.GetString(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
                    ? d.ToString("dd MMM yyyy", CultureInfo.InvariantCulture) : v.ToString();
            case "checkbox":
                return v.ValueKind == JsonValueKind.True ? "Yes" : "No";
            default:
                return v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : v.ToString();
        }
    }

    private static string Size(long b) => b < 1024 ? $"{b} B" : b < 1024 * 1024 ? $"{b / 1024.0:0.#} KB" : $"{b / 1024.0 / 1024.0:0.#} MB";
}
