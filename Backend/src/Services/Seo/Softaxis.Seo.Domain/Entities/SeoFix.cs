namespace Softaxis.Seo.Domain.Entities;

/// <summary>
/// The AI's proposed remediation for one <see cref="SeoIssue"/>. Only <c>Status == "applied"</c>
/// rows are ever served to the tenant's live site by the snippet (see
/// <c>SeoSnippetController.Rules</c>) — nothing changes on a tenant's site until a human approves
/// it. Approving IS the deploy step in Phase 1: there is no separate staging state.
/// </summary>
public sealed class SeoFix
{
    private SeoFix() { }

    public SeoFix(Guid issueId, Guid siteId, string? pageUrl, string changeType, string proposedValueJson, string rationale)
    {
        Id                = Guid.NewGuid();
        IssueId           = issueId;
        SiteId            = siteId;
        PageUrl           = pageUrl?.Trim();
        ChangeType        = changeType;
        ProposedValueJson = proposedValueJson;
        Rationale         = rationale.Trim();
        Status            = "pending_review";
        CreatedAt         = DateTime.UtcNow;
    }

    public Guid      Id                { get; private set; }
    public Guid      IssueId           { get; private set; }
    public Guid      SiteId            { get; private set; }
    public string?   PageUrl           { get; private set; }
    /// <summary>title | meta_description | canonical | schema | alt_text — see <see cref="SeoFixChangeTypes"/>.</summary>
    public string    ChangeType        { get; private set; } = string.Empty;
    /// <summary>JSON payload the snippet applies verbatim, e.g. {"value":"..."} or {"selector":"...","alt":"..."}.</summary>
    public string     ProposedValueJson { get; private set; } = string.Empty;
    public string     Rationale         { get; private set; } = string.Empty;
    /// <summary>pending_review | rejected | applied</summary>
    public string      Status            { get; private set; } = "pending_review";
    public Guid?      ReviewedByUserId  { get; private set; }
    public string?    ReviewedByName    { get; private set; }
    public DateTime?  ReviewedAt        { get; private set; }
    public DateTime?  AppliedAt         { get; private set; }
    public DateTime   CreatedAt         { get; private set; }

    public void Approve(Guid reviewerId, string reviewerName, string? editedValueJson)
    {
        if (!string.IsNullOrWhiteSpace(editedValueJson)) ProposedValueJson = editedValueJson;
        ReviewedByUserId = reviewerId;
        ReviewedByName   = reviewerName;
        ReviewedAt       = DateTime.UtcNow;
        Status           = "applied";
        AppliedAt        = DateTime.UtcNow;
    }

    public void Reject(Guid reviewerId, string reviewerName)
    {
        Status           = "rejected";
        ReviewedByUserId = reviewerId;
        ReviewedByName   = reviewerName;
        ReviewedAt       = DateTime.UtcNow;
    }
}

public static class SeoFixChangeTypes
{
    public const string Title           = "title";
    public const string MetaDescription = "meta_description";
    public const string Canonical       = "canonical";
    public const string Schema          = "schema";
    public const string AltText         = "alt_text";
}
