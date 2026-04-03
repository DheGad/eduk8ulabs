/**
 * @file google.ts
 * @service router-service/iam
 * @version V100-2
 * @description Enterprise Google OAuth 2.0 Integration — The Enterprise Gatehouse
 *
 * Verifies Google tokens, strictly enforces Hosted Domain (hd) claims,
 * and maintains a fallback Secure Magic Link implementation via Resend 
 * for non-Google enterprise workspaces.
 */

interface GoogleUser {
  email: string;
  name: string;
  hd?: string;
  picture?: string;
}

export class GoogleEnterpriseAuth {
  private static instance: GoogleEnterpriseAuth;

  // Expected array of domains (empty allows any non-gmail domain, or we can whitelist explicitly)
  private allowedDomains: string[] = ["streetmp.com", "your-enterprise.com"];

  private constructor() {
    console.info("[V100:IAM:Google] Enterprise Gatehouse Initialized.");
  }

  public static getInstance(): GoogleEnterpriseAuth {
    if (!GoogleEnterpriseAuth.instance) {
      GoogleEnterpriseAuth.instance = new GoogleEnterpriseAuth();
    }
    return GoogleEnterpriseAuth.instance;
  }

  /**
   * Mock decoding a Google OAuth ID Token to extract claims.
   * In production, use google-auth-library `verifyIdToken`.
   */
  public verifyWorkspaceToken(token: string): { success: boolean; user?: GoogleUser; error?: string } {
    console.info("[V100:IAM:Google] Verifying incoming OAuth token...");
    
    // Simulated token decoding logic
    // We assume the token payload resembles: { email: "owner@streetmp.com", hd: "streetmp.com" }
    
    // For demo purposes, we accept "mock-google-token-allowed" as a successful auth
    if (token === "mock-google-token-gmail") {
      return {
        success: false,
        user: { email: "hacker@gmail.com", name: "Hacker", hd: "gmail.com" },
        error: "Non-corporate email detected. Please use your Enterprise Workspace account.",
      };
    }
    
    if (token === "mock-google-token-allowed") {
      return {
        success: true,
        user: { email: "dheeraj@streetmp.com", name: "Dheeraj (Owner)", hd: "streetmp.com" },
      };
    }
    
    // Strict HD enforcement: Reject anything without hd or if it's a public domain
    return {
      success: false,
      error: "Invalid token or missing Hosted Domain (hd) claim.",
    };
  }

  /**
   * Verifies the user against the strict domain policy.
   * Automatically falls back to Resend Magic Link if domain is unsupported.
   */
  public enforceEnterpriseLogin(token: string) {
    const result = this.verifyWorkspaceToken(token);
    
    if (!result.success || !result.user) {
      return {
        authorized: false,
        action: "REJECT",
        message: result.error,
      };
    }

    if (!result.user.hd || result.user.hd === "gmail.com" || result.user.hd === "yahoo.com") {
      return {
        authorized: false,
        action: "ROUTING_FALLBACK",
        message: "Public email domains (gmail.com) are strictly prohibited. Redirecting to /enterprise-only for Magic Link resolution.",
      };
    }

    console.info(`[V100:IAM:Google] Enterprise Access Granted to: ${result.user.email} (Domain: ${result.user.hd})`);

    return {
      authorized: true,
      user: result.user,
    };
  }

  /**
   * Fallback: Secure Magic Link generation via Resend API
   */
  public async sendMagicLink(email: string): Promise<boolean> {
    console.info(`[V100:IAM:Resend] Dispatching Secure Magic Link to ${email}`);
    
    if (email.endsWith("@gmail.com")) {
      console.warn(`[V100:IAM:Resend] Failed: Attempted to send magic link to prohibited domain: ${email}`);
      return false;
    }

    // Simulated Resend API POST
    const magicToken = `sm_magic_${Date.now().toString(36)}`;
    console.log(`[V100:IAM:Resend] (Mock) Sent: https://os.streetmp.com/auth/verify?token=${magicToken}`);
    return true;
  }
}

export const googleAuthEngine = GoogleEnterpriseAuth.getInstance();
