namespace Softaxis.POS.Domain.Enums;

public enum PaymentMethod
{
    Cash          = 1,
    Card          = 2,
    DigitalWallet = 3,
    StoreCredit   = 4,
    Cheque        = 5,
    Mixed         = 6,
    BankTransfer  = 7,
    /// <summary>Bought on credit: charged to the customer's house account, paid later. No money arrives with the sale.</summary>
    HouseAccount  = 8,
}
