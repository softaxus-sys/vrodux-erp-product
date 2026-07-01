using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Auth.Commands.ResendVerification;

/// <summary>Re-send the email-verification link for an unverified account.</summary>
public sealed record ResendVerificationCommand(string Email) : ICommand;
