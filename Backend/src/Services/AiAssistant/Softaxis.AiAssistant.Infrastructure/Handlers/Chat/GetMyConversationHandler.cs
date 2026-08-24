using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.AiAssistant.Application.Chat.Queries;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Chat;

internal sealed class GetMyConversationHandler(AiAssistantDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetMyConversationQuery, AiConversationDto>
{
    public async Task<Result<AiConversationDto>> Handle(GetMyConversationQuery _, CancellationToken ct)
    {
        var userId = currentUser.Id;
        if (userId is null)
            return Result.Success(new AiConversationDto(null, []));

        var convo = await db.Conversations.AsNoTracking()
            .Include(c => c.Messages)
            .Where(c => c.UserId == userId.Value)
            .OrderByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        if (convo is null)
            return Result.Success(new AiConversationDto(null, []));

        var messages = convo.Messages
            .OrderBy(m => m.CreatedAt)
            .Select(m => new AiChatMessageDto(m.Id, m.Role, m.Content, m.CreatedAt, m.UsedFallback))
            .ToList();

        return Result.Success(new AiConversationDto(convo.Id, messages));
    }
}
