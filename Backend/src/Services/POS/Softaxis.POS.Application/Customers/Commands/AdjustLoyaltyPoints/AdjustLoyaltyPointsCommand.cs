using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Commands.AdjustLoyaltyPoints;

/// <summary>
/// Manual loyalty correction from the back office. Points is signed: positive adds (goodwill,
/// a missed sale), negative removes (a mistaken award). A removal can never take the balance
/// below zero — that is refused rather than clamped, so a typo is noticed instead of absorbed.
/// </summary>
public sealed record AdjustLoyaltyPointsCommand(Guid CustomerId, decimal Points, string? Reason)
    : ICommand<CustomerDto>;

public sealed class AdjustLoyaltyPointsValidator : AbstractValidator<AdjustLoyaltyPointsCommand>
{
    public AdjustLoyaltyPointsValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Points).NotEqual(0).WithMessage("Enter the number of points to add or remove.");
        RuleFor(x => x.Reason).MaximumLength(300);
    }
}

public sealed class AdjustLoyaltyPointsCommandHandler(ICustomerRepository customerRepo, IUnitOfWork uow)
    : ICommandHandler<AdjustLoyaltyPointsCommand, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(AdjustLoyaltyPointsCommand cmd, CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(cmd.CustomerId, ct);
        if (customer is null)
            return Result.Failure<CustomerDto>(Error.NotFoundById("Customer", cmd.CustomerId));

        if (cmd.Points > 0)
            customer.AddLoyaltyPoints(cmd.Points);
        else
        {
            var redeemed = customer.RedeemLoyaltyPoints(-cmd.Points);
            if (redeemed.IsFailure) return Result.Failure<CustomerDto>(redeemed.Error);
        }

        customerRepo.Update(customer);
        await uow.SaveChangesAsync(ct);
        return Result.Success(CustomerMappings.ToDto(customer));
    }
}
