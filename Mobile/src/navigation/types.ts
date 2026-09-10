export type AuthStackParamList = {
  Login: undefined;
  TwoFactor: { mfaToken: string; email: string };
};

export type LeadsStackParamList = {
  LeadsList: undefined;
  LeadDetail: { leadId: string; leadName: string };
};

export type DealsStackParamList = {
  DealsList: undefined;
  DealDetail: { dealId: string; dealTitle: string };
};

export type AppTabParamList = {
  Dashboard: undefined;
  Leads: undefined;
  Pipeline: undefined;
};
