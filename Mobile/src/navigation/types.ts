export type AuthStackParamList = {
  Login: undefined;
  TwoFactor: { mfaToken: string; email: string };
};

export type AppStackParamList = {
  Home: undefined;
};
