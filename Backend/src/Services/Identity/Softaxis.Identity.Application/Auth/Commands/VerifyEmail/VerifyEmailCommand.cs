using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Auth.Commands.VerifyEmail;

/// <summary>Verify a user's email using the token from the verification email.</summary>
public sealed record VerifyEmailCommand(string Email, string Token) : ICommand;
