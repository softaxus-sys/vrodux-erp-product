using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Comments.Dtos;

namespace Softaxis.ProjectManagement.Application.Comments.Commands;

public sealed record CreateCommentCommand(Guid IssueId, string AuthorName, string Body) : ICommand<CommentDto>;

public sealed class CreateCommentValidator : AbstractValidator<CreateCommentCommand>
{
    public CreateCommentValidator()
    {
        RuleFor(x => x.AuthorName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Body).NotEmpty().MaximumLength(5000);
    }
}

public sealed record UpdateCommentCommand(Guid Id, string Body) : ICommand<CommentDto>;

public sealed class UpdateCommentValidator : AbstractValidator<UpdateCommentCommand>
{
    public UpdateCommentValidator()
    {
        RuleFor(x => x.Body).NotEmpty().MaximumLength(5000);
    }
}

public sealed record DeleteCommentCommand(Guid Id) : ICommand;
