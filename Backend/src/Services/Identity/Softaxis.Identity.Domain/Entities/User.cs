using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Events;
using Softaxis.Identity.Domain.ValueObjects;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// User aggregate root.
/// All state mutations go through domain methods to enforce invariants.
/// </summary>
public sealed class User : AuditableEntity<Guid>
{
    private readonly List<UserRole> _userRoles = [];

    // EF Core constructor
    private User() { }

    private User(
        Guid   id,
        Email  email,
        string username,
        string firstName,
        string lastName,
        string passwordHash) : base(id)
    {
        Email        = email;
        Username     = username;
        FirstName    = firstName;
        LastName     = lastName;
        PasswordHash = passwordHash;
        Status       = UserStatus.PendingVerification;
        CreatedAt    = DateTime.UtcNow;
    }

    // ── Properties ────────────────────────────────────────────────────────────

    public Email       Email           { get; private set; } = null!;
    public string      Username        { get; private set; } = string.Empty;
    public string      FirstName       { get; private set; } = string.Empty;
    public string      LastName        { get; private set; } = string.Empty;
    public string      PasswordHash    { get; private set; } = string.Empty;
    public UserStatus  Status          { get; private set; }
    public bool        EmailVerified   { get; private set; }
    public string?     AvatarUrl       { get; private set; }
    public string?     PhoneNumber     { get; private set; }
    public DateTime?   LastLoginAt     { get; private set; }
    public int         FailedLoginCount { get; private set; }
    public DateTime?   LockedUntil     { get; private set; }

    /// <summary>
    /// Null for super-admin accounts. Non-null for all tenant users.
    /// </summary>
    public Guid?       TenantId        { get; private set; }

    /// <summary>
    /// Super-admins can manage all tenants and bypass plan limits.
    /// </summary>
    public bool        IsSuperAdmin    { get; private set; }

    public string?     PasswordResetTokenHash   { get; private set; }
    public DateTime?   PasswordResetTokenExpiry { get; private set; }

    public string FullName => $"{FirstName} {LastName}".Trim();

    // Navigation
    public IReadOnlyCollection<UserRole> UserRoles => _userRoles.AsReadOnly();

    // ── Factory ───────────────────────────────────────────────────────────────

    public static Result<User> Create(
        string email,
        string username,
        string firstName,
        string lastName,
        string passwordHash)
    {
        var emailResult = Email.Create(email);
        if (emailResult.IsFailure) return Result.Failure<User>(emailResult.Error);

        if (string.IsNullOrWhiteSpace(username))
            return Result.Failure<User>(Error.Custom("User.Username.Empty", "Username is required."));

        var user = new User(Guid.NewGuid(), emailResult.Value, username.Trim(), firstName.Trim(), lastName.Trim(), passwordHash);
        user.RaiseDomainEvent(new UserRegisteredEvent(user.Id, user.Email.Value));
        return Result.Success(user);
    }

    // ── Behaviour ─────────────────────────────────────────────────────────────

    public void UpdateProfile(string firstName, string lastName, string? phoneNumber, string? avatarUrl)
    {
        FirstName   = firstName.Trim();
        LastName    = lastName.Trim();
        PhoneNumber = phoneNumber?.Trim();
        AvatarUrl   = avatarUrl?.Trim();
        UpdatedAt   = DateTime.UtcNow;
    }

    public void ChangePassword(string newPasswordHash)
    {
        PasswordHash = newPasswordHash;
        UpdatedAt    = DateTime.UtcNow;
        RaiseDomainEvent(new UserPasswordChangedEvent(Id));
    }

    public void VerifyEmail()
    {
        EmailVerified = true;
        Status        = UserStatus.Active;
        UpdatedAt     = DateTime.UtcNow;
    }

    public void RecordLoginSuccess()
    {
        FailedLoginCount = 0;
        LockedUntil      = null;
        LastLoginAt      = DateTime.UtcNow;
    }

    public void RecordLoginFailure(int maxAttempts = 5)
    {
        FailedLoginCount++;
        if (FailedLoginCount >= maxAttempts)
        {
            Status      = UserStatus.Locked;
            LockedUntil = DateTime.UtcNow.AddMinutes(30);
            RaiseDomainEvent(new UserLockedEvent(Id, LockedUntil.Value));
        }
    }

    public void Unlock()
    {
        Status           = UserStatus.Active;
        FailedLoginCount = 0;
        LockedUntil      = null;
        UpdatedAt        = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        Status    = UserStatus.Inactive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        Status    = UserStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetTenant(Guid tenantId)
    {
        TenantId  = tenantId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MakeSuperAdmin()
    {
        IsSuperAdmin = true;
        TenantId     = null;
        UpdatedAt    = DateTime.UtcNow;
    }

    public void SetPasswordResetToken(string tokenHash, DateTime expiry)
    {
        PasswordResetTokenHash   = tokenHash;
        PasswordResetTokenExpiry = expiry;
        UpdatedAt                = DateTime.UtcNow;
    }

    public void ClearPasswordResetToken()
    {
        PasswordResetTokenHash   = null;
        PasswordResetTokenExpiry = null;
        UpdatedAt                = DateTime.UtcNow;
    }

    public bool IsPasswordResetTokenValid(string tokenHash) =>
        PasswordResetTokenHash == tokenHash &&
        PasswordResetTokenExpiry.HasValue &&
        PasswordResetTokenExpiry > DateTime.UtcNow;

    public bool IsLocked =>
        Status == UserStatus.Locked || (LockedUntil.HasValue && LockedUntil > DateTime.UtcNow);

    public void AssignRole(Guid roleId)
    {
        if (_userRoles.Any(ur => ur.RoleId == roleId)) return;
        _userRoles.Add(new UserRole { UserId = Id, RoleId = roleId });
    }

    public void RemoveRole(Guid roleId)
    {
        var userRole = _userRoles.FirstOrDefault(ur => ur.RoleId == roleId);
        if (userRole is not null) _userRoles.Remove(userRole);
    }
}
