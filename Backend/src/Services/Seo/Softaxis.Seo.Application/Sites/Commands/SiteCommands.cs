using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Sites.Dtos;

namespace Softaxis.Seo.Application.Sites.Commands;

public sealed record CreateSiteCommand(string Domain, string DisplayName, string? ScanFrequency) : ICommand<SiteDto>;

public sealed class CreateSiteValidator : AbstractValidator<CreateSiteCommand>
{
    public CreateSiteValidator()
    {
        RuleFor(x => x.Domain).NotEmpty().WithMessage("Domain is required.");
        RuleFor(x => x.DisplayName).NotEmpty().WithMessage("A display name is required.");
    }
}

public sealed record UpdateSiteCommand(Guid Id, string DisplayName, string ScanFrequency) : ICommand<SiteDto>;
public sealed record DeleteSiteCommand(Guid Id) : ICommand;
public sealed record RotateSnippetKeyCommand(Guid Id) : ICommand<SiteDto>;
