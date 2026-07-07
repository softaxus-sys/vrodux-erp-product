namespace Softaxis.Identity.Application.Abstractions;

/// <summary>Encrypts/decrypts the TOTP shared secret so it is never stored in plaintext.</summary>
public interface ITotpSecretProtector
{
    string Protect(string plaintext);
    string Unprotect(string ciphertext);
}
