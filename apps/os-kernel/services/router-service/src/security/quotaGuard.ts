// Export billing states for V98 Ops Agent
export const quotaGuard = {
  getBillingState: async (tenantId: string) => {
    return { status: "ACTIVE", tokensRemaining: 5000000, currentPlan: "PRO" };
  }
};
