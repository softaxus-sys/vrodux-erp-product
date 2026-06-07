using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.PaymentMethods.Queries.GetPaymentMethods;

/// <summary>
/// Returns all payment methods (system + custom, not soft-deleted),
/// ordered by SortOrder ascending.
/// The frontend filters by country and applies enabled/disabled display logic.
/// </summary>
public sealed record GetPaymentMethodsQuery : IQuery<List<PaymentMethodConfigDto>>;
