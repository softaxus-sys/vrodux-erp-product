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
    private readonly List<UserRole>       _userRoles       = [];
    private readonly List<UserPermission> _userPermissions = [];

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
    /// <summary>
    /// Set when an administrator hands over a temporary password (HR provisioning, admin reset).
    /// Cleared the moment the user sets their own — see <see cref="ChangePassword"/>, which is the
    /// only way a password is ever replaced, so the flag cannot be left stale.
    /// </summary>
    public bool        MustChangePassword { get; private set; }
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

    public string?     EmailVerificationTokenHash   { get; private set; }
    public DateTime?   EmailVerificationTokenExpiry { get; private set; }

    // ── Two-factor authentication (TOTP / authenticator app) ──────────────────
    public bool        TwoFactorEnabled { get; private set; }
    /// <summary>Encrypted-at-rest TOTP shared secret. Set while pending setup and while enabled.</summary>
    public string?     TwoFactorSecret  { get; private set; }
    /// <summary>Newline-joined SHA-256 hashes of the remaining one-time backup codes.</summary>
    public string?     TwoFactorBackupCodes { get; private set; }

    public string FullName => $"{FirstName} {LastName}".Trim();

    // Navigation
    public IReadOnlyCollection<UserRole>       UserRoles       => _userRoles.AsReadOnly();
    public IReadOnlyCollection<UserPermission> UserPermissions => _userPermissions.AsReadOnly();

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

    /// <summary>
    /// Moves the account to a new address. Email IS the login identity here — sign-in resolves an
    /// account by address alone — so the caller must have checked platform-wide uniqueness first.
    /// <paramref name="requireVerification"/> leaves the account unverified (and so unable to sign
    /// in until the new address is confirmed); an administrator making the change vouches for it
    /// instead, the same reasoning ProvisionUser uses when it verifies a login up front.
    /// </summary>
    public void ChangeEmail(Email newEmail, bool requireVerification)
    {
        Email     = newEmail;
        UpdatedAt = DateTime.UtcNow;

        // Any token outstanding was issued against the OLD address — it must not confirm the new one.
        EmailVerificationTokenHash   = null;
        EmailVerificationTokenExpiry = null;

        if (requireVerification)
        {
            EmailVerified = false;
            Status        = UserStatus.PendingVerification;
        }
    }

    /// <summary>Marks the current password as temporary — the user must replace it at next login.</summary>
    public void RequirePasswordChange() { MustChangePassword = true; UpdatedAt = DateTime.UtcNow; }

    public void ChangePassword(string newPasswordHash)
    {
        PasswordHash       = newPasswordHash;
        MustChangePassword = false;
        UpdatedAt    = DateTime.UtcNow;
        RaiseDomainEvent(new UserPasswordChangedEvent(Id));
    }

    public void VerifyEmail()
    {
        EmailVerified = true;
        Status        = UserStatus.Active;
        UpdatedAt     = DateTime.UtcNow;
    }

    /// <summary>
    /// A completed password reset proves the person reads mail at this address — the same thing
    /// email verification proves — so it confirms the address. Deliberately narrower than
    /// <see cref="VerifyEmail"/>: it promotes an account that was only PendingVerification, and
    /// leaves Inactive or Locked exactly as it found them, so resetting a password can never
    /// quietly re-enable an account an administrator disabled.
    /// </summary>
    public void ConfirmEmailViaPasswordReset()
    {
        EmailVerified = true;
        EmailVerificationTokenHash   = null;
        EmailVerificationTokenExpiry = null;
        if (Status == UserStatus.PendingVerification) Status = UserStatus.Active;
        UpdatedAt = DateTime.UtcNow;
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

    /// <summary>
    /// Compared in fixed time: ordinary string equality returns as soon as two characters differ,
    /// which leaks how much of a guess was correct. The comparison is on the stored HASH, and a
    /// hash only ever matches the account it was written to — a token issued for one user can
    /// never validate against another.
    /// </summary>
    public bool IsPasswordResetTokenValid(string tokenHash)
    {
        if (string.IsNullOrEmpty(PasswordResetTokenHash) || string.IsNullOrEmpty(tokenHash)) return false;
        if (!PasswordResetTokenExpiry.HasValue || PasswordResetTokenExpiry <= DateTime.UtcNow) return false;

        return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(PasswordResetTokenHash),
            System.Text.Encoding.UTF8.GetBytes(tokenHash));
    }

    // ── Email verification ────────────────────────────────────────────────────

    /// <summary>Issue a single-use email-verification token (hash stored, raw emailed to the user).</summary>
    public void SetEmailVerificationToken(string tokenHash, DateTime expiry)
    {
        EmailVerificationTokenHash   = tokenHash;
        EmailVerificationTokenExpiry = expiry;
        UpdatedAt                    = DateTime.UtcNow;
    }

    /// <summary>
    /// Verify the email using the token the user received. On success the account becomes Active and
    /// the token is cleared. Returns false if the token is wrong or expired.
    /// </summary>
    public bool VerifyEmailWithToken(string tokenHash)
    {
        var valid = EmailVerificationTokenHash == tokenHash
                    && EmailVerificationTokenExpiry.HasValue
                    && EmailVerificationTokenExpiry > DateTime.UtcNow;
        if (!valid) return false;

        EmailVerified                = true;
        Status                       = UserStatus.Active;
        EmailVerificationTokenHash   = null;
        EmailVerificationTokenExpiry = null;
        UpdatedAt                    = DateTime.UtcNow;
        return true;
    }

    // ── Two-factor authentication ─────────────────────────────────────────────

    /// <summary>
    /// Store a freshly generated (already-encrypted) TOTP secret pending the user's confirmation.
    /// Does NOT enable 2FA — the user must confirm a code first via <see cref="EnableTwoFactor"/>.
    /// </summary>
    public void SetTwoFactorSecret(string encryptedSecret)
    {
        TwoFactorSecret  = encryptedSecret;
        TwoFactorEnabled = false;
        UpdatedAt        = DateTime.UtcNow;
    }

    /// <summary>Activate 2FA after the user confirms a code. Stores the hashed one-time backup codes.</summary>
    public void EnableTwoFactor(IEnumerable<string> backupCodeHashes)
    {
        if (string.IsNullOrWhiteSpace(TwoFactorSecret)) return;   // no pending secret — no-op
        TwoFactorEnabled     = true;
        TwoFactorBackupCodes = string.Join('\n', backupCodeHashes);
        UpdatedAt            = DateTime.UtcNow;
    }

    public void DisableTwoFactor()
    {
        TwoFactorEnabled     = false;
        TwoFactorSecret      = null;
        TwoFactorBackupCodes = null;
        UpdatedAt            = DateTime.UtcNow;
    }

    /// <summary>Consume a one-time backup code by its hash. Returns true (and removes it) if present.</summary>
    public bool ConsumeBackupCode(string codeHash)
    {
        if (string.IsNullOrEmpty(TwoFactorBackupCodes)) return false;
        var codes = TwoFactorBackupCodes.Split('\n', StringSplitOptions.RemoveEmptyEntries).ToList();
        if (!codes.Remove(codeHash)) return false;
        TwoFactorBackupCodes = codes.Count > 0 ? string.Join('\n', codes) : null;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    public int BackupCodesRemaining =>
        string.IsNullOrEmpty(TwoFactorBackupCodes)
            ? 0
            : TwoFactorBackupCodes.Split('\n', StringSplitOptions.RemoveEmptyEntries).Length;

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

    /// <summary>
    /// Replace all per-user permission overrides. Each tuple is a (permissionId, isGranted) pair —
    /// isGranted=true adds a permission beyond the user's roles, isGranted=false explicitly denies one.
    /// Pass an empty sequence to clear all overrides (revert to pure role permissions).
    /// </summary>
    public void SetPermissionOverrides(IEnumerable<(Guid permissionId, bool isGranted)> overrides, string assignedBy = "system")
    {
        _userPermissions.Clear();
        foreach (var (permissionId, isGranted) in overrides.DistinctBy(o => o.permissionId))
            _userPermissions.Add(new UserPermission
            {
                UserId       = Id,
                PermissionId = permissionId,
                IsGranted    = isGranted,
                AssignedBy   = assignedBy,
            });
        UpdatedAt = DateTime.UtcNow;
    }
}
