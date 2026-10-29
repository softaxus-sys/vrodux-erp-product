using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Ecommerce.Application.Shop;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Persistence;
using Softaxis.Ecommerce.Infrastructure.Services.Shop;

namespace Softaxis.Ecommerce.Infrastructure.Handlers.Shop;

internal static class ShopAccounts
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan LockFor = TimeSpan.FromMinutes(15);

    public static ShopCustomerDto ToDto(StoreCustomer c) => new(c.Id, c.Email, c.FirstName, c.LastName, c.Phone, c.AcceptsMarketing);
    public static ShopAddressDto ToDto(StoreCustomerAddress a) => new(a.Id, a.Name, a.Phone, a.Line1, a.Line2, a.City, a.Region, a.PostalCode, a.Country, a.IsDefault);

    /// <summary>
    /// The signed-in shopper. Read again on every request, so a deleted account or a changed password ends open sessions at once
    /// instead of when the token runs out. Call after <see cref="ShopDoor.Enter"/>.
    /// </summary>
    public static async Task<Result<StoreCustomer>> CustomerAsync(EcommerceDbContext db, IShopSecurity security, ShopDoor door, string? token, bool tracked, CancellationToken ct)
    {
        var session = security.ReadSession(token);
        if (session is null || session.TenantId != door.Tenant.Id) return Result.Failure<StoreCustomer>(ShopErrors.SignInAgain);
        var customers = tracked ? db.Customers : db.Customers.AsNoTracking();
        var customer = await customers.FirstOrDefaultAsync(c => c.Id == session.CustomerId && !c.IsDeleted, ct);
        if (customer is null || !security.StampMatches(session, customer.PasswordHash)) return Result.Failure<StoreCustomer>(ShopErrors.SignInAgain);
        return Result.Success(customer);
    }

    public static ShopSessionDto Session(IShopSecurity security, ShopDoor door, StoreCustomer c)
    {
        var (token, expires) = security.CreateSession(door.Tenant.Id, c.Id, c.PasswordHash);
        return new ShopSessionDto(token, expires, ToDto(c));
    }
}

internal sealed class ShopRegisterHandler(ShopGate gate, EcommerceDbContext db, IShopSecurity security, IShopMailer mailer, ShopLinks links)
    : ICommandHandler<ShopRegisterCommand, ShopSessionDto>
{
    public async Task<Result<ShopSessionDto>> Handle(ShopRegisterCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopSessionDto>(door.Error);
        door.Value.Enter();

        var email = c.Email.Trim().ToLowerInvariant();
        if (await db.Customers.AnyAsync(x => x.Email == email && !x.IsDeleted, ct))
            return Result.Failure<ShopSessionDto>(Error.Custom("Account.Duplicate", "An account with that email already exists. Try signing in."));

        var customer = new StoreCustomer(email, security.HashPassword(c.Password), c.FirstName, c.LastName, c.Phone) { AcceptsMarketing = c.AcceptsMarketing };
        db.Customers.Add(customer);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return Result.Failure<ShopSessionDto>(Error.Custom("Account.Duplicate", "An account with that email already exists. Try signing in.")); }

        var (subject, html) = ShopEmails.Welcome(door.Value.Store, customer.FirstName, links.ShopUrl(door.Value.Store, null));
        _ = mailer.SendAsync(customer.Email, customer.FullName, subject, html, CancellationToken.None);   // best effort; never holds up sign-up
        return Result.Success(ShopAccounts.Session(security, door.Value, customer));
    }
}

internal sealed class ShopSignInHandler(ShopGate gate, EcommerceDbContext db, IShopSecurity security) : ICommandHandler<ShopSignInCommand, ShopSessionDto>
{
    public async Task<Result<ShopSessionDto>> Handle(ShopSignInCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopSessionDto>(door.Error);
        door.Value.Enter();

        var email = (c.Email ?? "").Trim().ToLowerInvariant();
        var customer = await db.Customers.FirstOrDefaultAsync(x => x.Email == email && !x.IsDeleted, ct);
        // Same message whether the email is unknown, locked or wrong: which addresses have accounts is not for a stranger to learn.
        if (customer is null)
        {
            security.HashPassword(c.Password ?? "");   // spend the same time, so response time does not reveal which emails exist
            return Result.Failure<ShopSessionDto>(ShopErrors.BadLogin);
        }
        if (customer.LockedUntil > DateTime.UtcNow)
            return Result.Failure<ShopSessionDto>(Error.Custom("Account.Unauthorized", "Too many attempts. Please try again in a few minutes."));

        if (!security.VerifyPassword(c.Password ?? "", customer.PasswordHash))
        {
            customer.FailedAttempts++;
            if (customer.FailedAttempts >= ShopAccounts.MaxFailedAttempts) { customer.LockedUntil = DateTime.UtcNow.Add(ShopAccounts.LockFor); customer.FailedAttempts = 0; }
            await db.SaveChangesAsync(ct);
            return Result.Failure<ShopSessionDto>(ShopErrors.BadLogin);
        }

        customer.FailedAttempts = 0; customer.LockedUntil = null; customer.LastSignInAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Result.Success(ShopAccounts.Session(security, door.Value, customer));
    }
}

internal sealed class GetShopAccountHandler(ShopGate gate, EcommerceDbContext db, IShopSecurity security) : IQueryHandler<GetShopAccountQuery, ShopAccountDto>
{
    public async Task<Result<ShopAccountDto>> Handle(GetShopAccountQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopAccountDto>(door.Error);
        door.Value.Enter();
        var me = await ShopAccounts.CustomerAsync(db, security, door.Value, q.Token, false, ct);
        if (me.IsFailure) return Result.Failure<ShopAccountDto>(me.Error);
        var addresses = await db.CustomerAddresses.AsNoTracking().Where(a => a.CustomerId == me.Value.Id).OrderByDescending(a => a.IsDefault).ToListAsync(ct);
        return Result.Success(new ShopAccountDto(ShopAccounts.ToDto(me.Value), addresses.Select(ShopAccounts.ToDto).ToList()));
    }
}

internal sealed class GetShopMyOrdersHandler(ShopGate gate, EcommerceDbContext db, IShopSecurity security) : IQueryHandler<GetShopMyOrdersQuery, PagedResult<ShopOrderSummaryDto>>
{
    public async Task<Result<PagedResult<ShopOrderSummaryDto>>> Handle(GetShopMyOrdersQuery q, CancellationToken ct)
    {
        var door = await gate.OpenAsync(q.Slug, ct);
        if (door.IsFailure) return Result.Failure<PagedResult<ShopOrderSummaryDto>>(door.Error);
        door.Value.Enter();
        var me = await ShopAccounts.CustomerAsync(db, security, door.Value, q.Token, false, ct);
        if (me.IsFailure) return Result.Failure<PagedResult<ShopOrderSummaryDto>>(me.Error);

        var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 50);
        var query = db.StoreOrders.AsNoTracking().Where(o => o.CustomerId == me.Value.Id);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(o => o.CreatedAt).Skip((page - 1) * size).Take(size)
            .Select(o => new ShopOrderSummaryDto(o.Number, o.AccessToken, o.Status, o.PaymentStatus, o.Total, o.CurrencyCode, o.Lines.Sum(l => l.Quantity), o.CreatedAt))
            .ToListAsync(ct);
        return Result.Success(PagedResult<ShopOrderSummaryDto>.Create(rows, total, page, size));
    }
}

internal sealed class UpdateShopAccountHandler(ShopGate gate, EcommerceDbContext db, IShopSecurity security) : ICommandHandler<UpdateShopAccountCommand, ShopAccountDto>
{
    public async Task<Result<ShopAccountDto>> Handle(UpdateShopAccountCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopAccountDto>(door.Error);
        door.Value.Enter();
        var me = await ShopAccounts.CustomerAsync(db, security, door.Value, c.Token, true, ct);
        if (me.IsFailure) return Result.Failure<ShopAccountDto>(me.Error);
        var cust = me.Value;

        if (string.IsNullOrWhiteSpace(c.FirstName) || string.IsNullOrWhiteSpace(c.LastName))
            return Result.Failure<ShopAccountDto>(ShopErrors.Invalid("Please enter your first and last name."));

        if (!string.IsNullOrEmpty(c.NewPassword))
        {
            if (c.NewPassword.Length < 8 || c.NewPassword.Length > 100) return Result.Failure<ShopAccountDto>(ShopErrors.Invalid("A password needs at least 8 characters."));
            if (!security.VerifyPassword(c.CurrentPassword ?? "", cust.PasswordHash)) return Result.Failure<ShopAccountDto>(ShopErrors.Invalid("Your current password is not right."));
            cust.PasswordHash = security.HashPassword(c.NewPassword);
        }
        cust.FirstName = c.FirstName.Trim(); cust.LastName = c.LastName.Trim();
        cust.Phone = string.IsNullOrWhiteSpace(c.Phone) ? null : c.Phone.Trim(); cust.AcceptsMarketing = c.AcceptsMarketing;
        await db.SaveChangesAsync(ct);

        var addresses = await db.CustomerAddresses.AsNoTracking().Where(a => a.CustomerId == cust.Id).OrderByDescending(a => a.IsDefault).ToListAsync(ct);
        return Result.Success(new ShopAccountDto(ShopAccounts.ToDto(cust), addresses.Select(ShopAccounts.ToDto).ToList()));
    }
}

internal sealed class SaveShopAddressHandler(ShopGate gate, EcommerceDbContext db, IShopSecurity security) : ICommandHandler<SaveShopAddressCommand, ShopAddressDto>
{
    public async Task<Result<ShopAddressDto>> Handle(SaveShopAddressCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct);
        if (door.IsFailure) return Result.Failure<ShopAddressDto>(door.Error);
        door.Value.Enter();
        var me = await ShopAccounts.CustomerAsync(db, security, door.Value, c.Token, false, ct);
        if (me.IsFailure) return Result.Failure<ShopAddressDto>(me.Error);

        StoreCustomerAddress? a = null;
        if (c.Id is Guid id)
        {
            // Scoped to the signed-in shopper: someone else's address id is simply not found.
            a = await db.CustomerAddresses.FirstOrDefaultAsync(x => x.Id == id && x.CustomerId == me.Value.Id, ct);
            if (a is null) return Result.Failure<ShopAddressDto>(Error.Custom("Address.NotFound", "That address was not found."));
        }
        else
        {
            if (await db.CustomerAddresses.CountAsync(x => x.CustomerId == me.Value.Id, ct) >= 20)
                return Result.Failure<ShopAddressDto>(ShopErrors.Invalid("You can save up to 20 addresses."));
            a = new StoreCustomerAddress(me.Value.Id);
            db.CustomerAddresses.Add(a);
        }
        a.Name = c.Name.Trim(); a.Phone = string.IsNullOrWhiteSpace(c.Phone) ? null : c.Phone.Trim(); a.Line1 = c.Line1.Trim();
        a.Line2 = string.IsNullOrWhiteSpace(c.Line2) ? null : c.Line2.Trim(); a.City = c.City.Trim();
        a.Region = string.IsNullOrWhiteSpace(c.Region) ? null : c.Region.Trim(); a.PostalCode = string.IsNullOrWhiteSpace(c.PostalCode) ? null : c.PostalCode.Trim();
        a.Country = c.Country.Trim().ToUpperInvariant();
        if (c.IsDefault)
        {
            foreach (var other in await db.CustomerAddresses.Where(x => x.CustomerId == me.Value.Id && x.Id != a.Id && x.IsDefault).ToListAsync(ct)) other.IsDefault = false;
            a.IsDefault = true;
        }
        else if (!await db.CustomerAddresses.AnyAsync(x => x.CustomerId == me.Value.Id && x.IsDefault && x.Id != a.Id, ct)) a.IsDefault = true;   // there is always one default
        await db.SaveChangesAsync(ct);
        return Result.Success(ShopAccounts.ToDto(a));
    }
}

internal sealed class DeleteShopAddressHandler(ShopGate gate, EcommerceDbContext db, IShopSecurity security) : ICommandHandler<DeleteShopAddressCommand>
{
    public async Task<Result> Handle(DeleteShopAddressCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct);
        if (door.IsFailure) return Result.Failure(door.Error);
        door.Value.Enter();
        var me = await ShopAccounts.CustomerAsync(db, security, door.Value, c.Token, false, ct);
        if (me.IsFailure) return Result.Failure(me.Error);
        var a = await db.CustomerAddresses.FirstOrDefaultAsync(x => x.Id == c.Id && x.CustomerId == me.Value.Id, ct);
        if (a is null) return Result.Failure(Error.Custom("Address.NotFound", "That address was not found."));
        db.CustomerAddresses.Remove(a);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class ShopForgotPasswordHandler(ShopGate gate, EcommerceDbContext db, IShopSecurity security, IShopMailer mailer, ShopLinks links)
    : ICommandHandler<ShopForgotPasswordCommand>
{
    public async Task<Result> Handle(ShopForgotPasswordCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct);
        if (door.IsFailure) return Result.Failure(door.Error);
        door.Value.Enter();

        var email = (c.Email ?? "").Trim().ToLowerInvariant();
        var customer = await db.Customers.FirstOrDefaultAsync(x => x.Email == email && !x.IsDeleted, ct);
        // Always "success": whether an account exists must not be learnable from this form.
        if (customer is null) return Result.Success();

        var token = security.NewResetToken();
        customer.ResetTokenHash = security.HashResetToken(token);
        customer.ResetExpiresAt = DateTime.UtcNow.AddHours(1);
        await db.SaveChangesAsync(ct);

        var link = links.ShopUrl(door.Value.Store, c.Origin, $"/account/reset?email={Uri.EscapeDataString(customer.Email)}&token={token}");
        var (subject, html) = ShopEmails.PasswordReset(door.Value.Store, link);
        var to = customer.Email; var toName = customer.FullName;
        _ = Task.Run(() => mailer.SendAsync(to, toName, subject, html, CancellationToken.None));   // never makes the reply slower for known emails than unknown ones
        return Result.Success();
    }
}

internal sealed class ShopResetPasswordHandler(ShopGate gate, EcommerceDbContext db, IShopSecurity security) : ICommandHandler<ShopResetPasswordCommand>
{
    public async Task<Result> Handle(ShopResetPasswordCommand c, CancellationToken ct)
    {
        var door = await gate.OpenAsync(c.Slug, ct);
        if (door.IsFailure) return Result.Failure(door.Error);
        door.Value.Enter();

        if ((c.NewPassword ?? "").Length is < 8 or > 100) return Result.Failure(ShopErrors.Invalid("A password needs at least 8 characters."));
        var email = (c.Email ?? "").Trim().ToLowerInvariant();
        var customer = await db.Customers.FirstOrDefaultAsync(x => x.Email == email && !x.IsDeleted, ct);
        var bad = Result.Failure(ShopErrors.Invalid("This reset link is invalid or has expired."));
        if (customer?.ResetTokenHash is null || customer.ResetExpiresAt < DateTime.UtcNow) return bad;
        if (!string.Equals(customer.ResetTokenHash, security.HashResetToken(c.Token ?? ""), StringComparison.Ordinal)) return bad;

        customer.PasswordHash = security.HashPassword(c.NewPassword!);   // also ends every open session: the token stamp comes from the hash
        customer.ResetTokenHash = null; customer.ResetExpiresAt = null; customer.FailedAttempts = 0; customer.LockedUntil = null;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
