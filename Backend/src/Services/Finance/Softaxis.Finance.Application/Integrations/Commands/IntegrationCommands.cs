using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Integrations.Dtos;

namespace Softaxis.Finance.Application.Integrations.Commands;

/// <param name="AcknowledgeAuto">Must be true to switch automatic posting on: the caller has been
/// shown what it will post without review.</param>
public sealed record UpdateIntegrationSettingCommand(
    string IntegrationKey, string Mode, string? StartDate, string? UserName,
    bool AcknowledgeAuto = false) : ICommand;

public sealed class UpdateIntegrationSettingValidator : AbstractValidator<UpdateIntegrationSettingCommand>
{
    private static readonly string[] Modes = ["off", "review", "auto"];

    public UpdateIntegrationSettingValidator()
    {
        RuleFor(x => x.IntegrationKey).NotEmpty().MaximumLength(60);
        RuleFor(x => x.Mode).Must(m => Modes.Contains(m)).WithMessage("Mode must be off, review or auto.");
        RuleFor(x => x.StartDate)
            .Must(d => string.IsNullOrWhiteSpace(d)
                    || DateOnly.TryParseExact(d, "yyyy-MM-dd", out _))
            .WithMessage("Start date must be a date (yyyy-MM-dd).");
    }
}

public sealed record AccountMappingInput(string Role, Guid? AccountId);

/// <summary>Replaces the mappings for one integration. A null account clears the role back to its default.</summary>
public sealed record SaveAccountMappingsCommand(
    string IntegrationKey, IReadOnlyList<AccountMappingInput> Mappings) : ICommand;

public sealed class SaveAccountMappingsValidator : AbstractValidator<SaveAccountMappingsCommand>
{
    public SaveAccountMappingsValidator()
    {
        RuleFor(x => x.IntegrationKey).NotEmpty().MaximumLength(60);
        RuleFor(x => x.Mappings).NotNull();
        RuleForEach(x => x.Mappings).ChildRules(m => m.RuleFor(x => x.Role).NotEmpty().MaximumLength(40));
    }
}

/// <summary>Collects new documents for every switched-on integration (or just one).</summary>
public sealed record SyncIntegrationsCommand(string? IntegrationKey, string? UserName) : ICommand<SyncResultDto>;

/// <param name="ControlTotal">The debit total the caller was shown when it checked this selection.
/// When given, nothing is posted unless the selection still comes to that figure.</param>
public sealed record PostItemsCommand(
    IReadOnlyList<Guid> Ids, string? UserName, decimal? ControlTotal = null, PostingCaller? Caller = null)
    : ICommand<PostResultDto>;

public sealed class PostItemsValidator : AbstractValidator<PostItemsCommand>
{
    public const int MaxItems = 500;

    public PostItemsValidator()
    {
        RuleFor(x => x.Ids).NotEmpty().WithMessage("Choose at least one item to post.");
        RuleFor(x => x.Ids).Must(i => i is null || i.Count <= MaxItems)
            .WithMessage($"At most {MaxItems} items can be posted in one request.");
    }
}

/// <summary>Posts every failed item again (optionally for one integration).</summary>
public sealed record RetryFailedCommand(string? IntegrationKey, string? UserName, PostingCaller? Caller = null) : ICommand<PostResultDto>;

public sealed record SkipItemCommand(Guid Id, string? Reason) : ICommand;

public sealed record RequeueItemCommand(Guid Id) : ICommand;

/// <param name="Reason">Why the entry is wrong. Required: a reversal is a correction somebody may be asked about.</param>
public sealed record ReverseItemCommand(Guid Id, string? Reason, string? UserName, PostingCaller? Caller = null) : ICommand;

public sealed class ReverseItemValidator : AbstractValidator<ReverseItemCommand>
{
    public ReverseItemValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Say why the entry is being reversed.")
            .MaximumLength(500);
    }
}

/// <summary>Puts waiting documents forward for approval (or takes them back).</summary>
public sealed record SubmitItemsCommand(
    IReadOnlyList<Guid> Ids, string? UserName, Guid? UserId, bool Withdraw = false,
    IReadOnlyList<string>? Modules = null) : ICommand<SubmitResultDto>;

/// <summary>Sets who may approve what for one integration: a value limit and a second-person rule.</summary>
public sealed record UpdateApprovalRulesCommand(
    string IntegrationKey, decimal? ApprovalLimit, bool RequireSeparateApprover, string? UserName) : ICommand;

public sealed class UpdateApprovalRulesValidator : AbstractValidator<UpdateApprovalRulesCommand>
{
    public UpdateApprovalRulesValidator()
    {
        RuleFor(x => x.IntegrationKey).NotEmpty().MaximumLength(60);
        RuleFor(x => x.ApprovalLimit).GreaterThan(0).When(x => x.ApprovalLimit.HasValue)
            .WithMessage("The approval limit must be more than zero. Leave it empty for no limit.");
    }
}

public sealed class SubmitItemsValidator : AbstractValidator<SubmitItemsCommand>
{
    public SubmitItemsValidator()
    {
        RuleFor(x => x.Ids).NotEmpty().WithMessage("Choose at least one document.");
        RuleFor(x => x.Ids).Must(i => i is null || i.Count <= PostItemsValidator.MaxItems)
            .WithMessage($"At most {PostItemsValidator.MaxItems} documents at a time.");
    }
}
