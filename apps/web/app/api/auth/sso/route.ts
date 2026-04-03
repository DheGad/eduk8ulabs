import { NextRequest, NextResponse } from "next/server";

/**
 * @file route.ts
 * @package apps/web/api/auth/sso
 * @description Enterprise SSO Connector (SAML 2.0 / OIDC)
 *
 * CB-3 Fix: The SSO endpoint now requires SSO_ENABLED=true to be explicitly
 * set in the production environment. Until real x509/SAML signature verification
 * is implemented (via node-saml or similar), this gate prevents the stub handler
 * from being used as an authentication bypass.
 */

function ssoDisabled(): NextResponse {
  return NextResponse.json(
    {
      error: "Enterprise SSO is not yet enabled on this node.",
      detail: "Contact your StreetMP administrator to enable SAML/OIDC federation.",
    },
    { status: 503 }
  );
}

export async function GET(req: NextRequest) {
  if (process.env.SSO_ENABLED !== "true") return ssoDisabled();

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") || "okta";
  const orgId = searchParams.get("org_id");

  if (!orgId) {
    return NextResponse.json(
      { error: "Missing Target Organization ID for SSO Federation." },
      { status: 400 }
    );
  }

  // Map strict redirect URI back to Sovereign Enclave dashboard
  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/sovereign`);

  // IDP URL construction (real implementation must use signed SAMLRequest)
  let idpUrl = "";
  if (provider === "okta")  idpUrl = `https://idp.okta.com/saml2/sso/${orgId}?RelayState=${redirectUri}`;
  if (provider === "azure") idpUrl = `https://login.microsoftonline.com/${orgId}/saml2?RelayState=${redirectUri}`;

  return NextResponse.redirect(idpUrl || `https://streetmp.com/auth/error?reason=unsupported_sso`);
}

export async function POST(req: NextRequest) {
  // CB-3 Gate: SSO must be explicitly enabled in production env
  if (process.env.SSO_ENABLED !== "true") return ssoDisabled();

  // SAML Assertion Consumer Service (ACS) Endpoint
  // TODO: Implement real SAML signature verification before removing this gate.
  // Required: npm install node-saml
  // Steps:
  //   1. Load IDP x509 certificate from env/vault
  //   2. const saml = new SAML({ cert: IDP_CERT, issuer: SP_ENTITY_ID });
  //   3. const profile = await saml.validatePostResponseAsync(formData);
  //   4. Extract NameID, role groups, issue internal JWT
  try {
    const formData = await req.formData();
    const samlResponse = formData.get("SAMLResponse")?.toString();

    if (!samlResponse) {
      return NextResponse.json({ error: "No SAML Assertion provided" }, { status: 401 });
    }

    // Placeholder — real verification required before SSO_ENABLED is set to true
    return NextResponse.json(
      { error: "SAML verification not yet implemented. Set SSO_ENABLED=false." },
      { status: 501 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    // Do not log the raw error — it may contain assertion data
    return NextResponse.redirect(new URL(`/login?error=sso_failed&detail=${encodeURIComponent(msg)}`, req.url));
  }
}
