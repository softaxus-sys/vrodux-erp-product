using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Chat.Commands;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Chat;

internal sealed class ClearMyConversationHandler(AiAssistantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<ClearMyConversationCommand>
{
    public async Task<Result> Handle(ClearMyConversationCommand _, CancellationToken ct)
    {
        var userId = currentUser.Id;
        if (userId is null) return Result.Success();

        var conversations = await db.Conversations
            .Where(c => c.UserId == userId.Value)
            .ToListAsync(ct);

        if (conversations.Count == 0) return Result.Success();

        db.Conversations.RemoveRange(conversations);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
