namespace Softaxis.AiAssistant.Domain.Entities;

/// <summary>
/// One user's ongoing assistant conversation. Each user has at most one active conversation at a
/// time, so chat history persists across page navigation (and login sessions) without leaking
/// between users — tenant isolation is applied automatically via the shared shadow-column filter,
/// and <see cref="UserId"/> further scopes it to the one person who chatted.
/// </summary>
public sealed class AiConversation
{
    private AiConversation() { }

    public AiConversation(Guid userId)
    {
        Id        = Guid.NewGuid();
        UserId    = userId;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public Guid     Id        { get; private set; }
    public Guid     UserId    { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public ICollection<AiConversationMessage> Messages { get; private set; } = new List<AiConversationMessage>();

    public void Touch() => UpdatedAt = DateTime.UtcNow;
}

/// <summary>One persisted turn (user or assistant) in an <see cref="AiConversation"/>.</summary>
public sealed class AiConversationMessage
{
    private AiConversationMessage() { }

    public AiConversationMessage(Guid conversationId, string role, string content, bool usedFallback = false)
    {
        Id             = Guid.NewGuid();
        ConversationId = conversationId;
        Role           = role;
        Content        = content;
        CreatedAt      = DateTime.UtcNow;
        UsedFallback   = usedFallback;
    }

    public Guid     Id             { get; private set; }
    public Guid     ConversationId { get; private set; }
    public string   Role           { get; private set; } = string.Empty; // "user" | "assistant"
    public string   Content        { get; private set; } = string.Empty;
    public DateTime CreatedAt      { get; private set; }

    /// <summary>True when this assistant reply came from the tenant's fallback provider, not the primary.</summary>
    public bool      UsedFallback  { get; private set; }
}
