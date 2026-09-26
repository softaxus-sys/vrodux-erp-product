namespace Softaxis.Seo.Domain.Entities;

/// <summary>
/// One AI-drafted SEO article, queued for human review before it goes anywhere — same trust model as
/// <see cref="SeoFix"/>: the AI proposes, a person approves. Unlike a fix, approving an article does
/// NOT make it live anywhere by itself (there is no "snippet" for a whole page) — it only unlocks
/// export/copy, and an optional push to WordPress if the site has one connected. Nothing is ever
/// auto-published to a live site without an explicit action after approval.
/// </summary>
public sealed class SeoArticle
{
    private SeoArticle() { }

    public SeoArticle(Guid siteId, string title, string slug, string metaDescription,
        string targetKeyword, string bodyMarkdown, string sourceSignalsJson)
    {
        Id                = Guid.NewGuid();
        SiteId            = siteId;
        Title             = Trim(title, 300);
        Slug              = Trim(slug, 200);
        MetaDescription   = Trim(metaDescription, 320);
        TargetKeyword     = Trim(targetKeyword, 200);
        BodyMarkdown      = bodyMarkdown;
        WordCount         = CountWords(bodyMarkdown);
        SourceSignalsJson = sourceSignalsJson;
        Status            = "pending_review";
        CreatedAt         = DateTime.UtcNow;
    }

    public Guid     Id                { get; private set; }
    public Guid     SiteId            { get; private set; }
    public string   Title             { get; private set; } = string.Empty;
    public string   Slug              { get; private set; } = string.Empty;
    public string   MetaDescription   { get; private set; } = string.Empty;
    public string   TargetKeyword     { get; private set; } = string.Empty;
    public string   BodyMarkdown      { get; private set; } = string.Empty;
    public int      WordCount         { get; private set; }
    /// <summary>What research drove this topic — GSC queries, competitor pages, or "AI-suggested" —
    /// shown to the reviewer so "why this topic" is never a black box. See ContentResearch.</summary>
    public string   SourceSignalsJson { get; private set; } = "[]";
    public string   Status            { get; private set; } = "pending_review"; // pending_review | approved | rejected
    public Guid?    ReviewedByUserId  { get; private set; }
    public string?  ReviewedByName    { get; private set; }
    public DateTime? ReviewedAt       { get; private set; }
    /// <summary>Set only if a WordPress push actually happened — never implied by Approve alone.</summary>
    public int?      WordPressPostId  { get; private set; }
    public DateTime? PushedToWordPressAt { get; private set; }

    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Approve(Guid userId, string userName)
    {
        Status = "approved";
        ReviewedByUserId = userId;
        ReviewedByName = userName;
        ReviewedAt = DateTime.UtcNow;
        Touch();
    }

    public void Reject(Guid userId, string userName)
    {
        Status = "rejected";
        ReviewedByUserId = userId;
        ReviewedByName = userName;
        ReviewedAt = DateTime.UtcNow;
        Touch();
    }

    public void RecordWordPressPush(int postId)
    {
        WordPressPostId = postId;
        PushedToWordPressAt = DateTime.UtcNow;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static string Trim(string s, int max) =>
        string.IsNullOrWhiteSpace(s) ? "" : (s.Trim().Length > max ? s.Trim()[..max] : s.Trim());

    private static int CountWords(string markdown) =>
        string.IsNullOrWhiteSpace(markdown) ? 0 : markdown.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length;
}
