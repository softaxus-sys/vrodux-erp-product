using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Auth.Commands.IssueServiceToken;

/// <summary>
/// Mints an access token for a user WITHOUT a password — for trusted server-side callers only
/// (e.g. the AI Assistant acting as a linked Telegram user). There is intentionally NO controller
/// for this command; it can only be sent in-process via MediatR.
/// </summary>
public sealed record IssueServiceTokenCommand(Guid UserId) : ICommand<ServiceTokenDto>;
