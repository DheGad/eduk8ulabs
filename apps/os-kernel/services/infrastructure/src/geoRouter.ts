/**
 * @file geoRouter.ts
 * @service os-kernel/services/infrastructure
 * @version V59
 * @description Geolocated Routing & Data Residency Enforcement — StreetMP OS
 *
 * Detects the geographic origin of every proxy request and enforces
 * jurisdictional data residency policies. A RESIDENCY_VIOLATION is
 * raised — and the request is hard-blocked — when a payload from one
 * region is about to be processed by an AI endpoint in a non-authorised
 * jurisdiction (e.g. APAC data routed to a US_EAST model).
 *
 * Tech Stack Lock : TypeScript · Node.js · Zero Python
 * Compliance      : GDPR (EU) · PDPA (APAC) · CCPA (US)
 */

import crypto from "crypto";

// ================================================================
// TYPES
// ================================================================

export type GeoRegion = "APAC" | "EU" | "US_EAST" | "US_WEST" | "UNKNOWN";

export interface RegionPolicy {
  region:            GeoRegion;
  allowedEndpoints:  GeoRegion[];     // which target regions are permitted
  dataResidencyAct:  string;          // governing regulation label
  nodeLocations:     string[];
}

export interface GeoRoutingResult {
  originRegion:    GeoRegion;
  targetRegion:    GeoRegion;
  allowed:         boolean;
  traceId:         string;
  timestamp:       number;
  regulationRef:   string;
}

export interface ResidencyViolation {
  code:          "RESIDENCY_VIOLATION";
  originRegion:  GeoRegion;
  targetRegion:  GeoRegion;
  reason:        string;
  regulation:    string;
  traceId:       string;
  timestamp:     number;
}

// ================================================================
// REGION POLICIES — data residency rules per jurisdiction
// ================================================================

const REGION_POLICIES: Record<GeoRegion, RegionPolicy> = {
  APAC: {
    region:           "APAC",
    allowedEndpoints: ["APAC"],           // PDPA: data must stay in APAC
    dataResidencyAct: "PDPA (Malaysia/Singapore) · PIPL (China)",
    nodeLocations:    ["KL (ap-southeast-1)", "Singapore (ap-southeast-1)", "Tokyo (ap-northeast-1)"],
  },
  EU: {
    region:           "EU",
    allowedEndpoints: ["EU"],             // GDPR: strict EU-only residency
    dataResidencyAct: "GDPR (EU) Art. 44-49",
    nodeLocations:    ["Frankfurt (eu-central-1)", "Dublin (eu-west-1)", "Paris (eu-west-3)"],
  },
  US_EAST: {
    region:           "US_EAST",
    allowedEndpoints: ["US_EAST", "US_WEST"], // US data can cross internal US
    dataResidencyAct: "CCPA · HIPAA (if medical)",
    nodeLocations:    ["N. Virginia (us-east-1)", "Ohio (us-east-2)"],
  },
  US_WEST: {
    region:           "US_WEST",
    allowedEndpoints: ["US_EAST", "US_WEST"],
    dataResidencyAct: "CCPA · HIPAA (if medical)",
    nodeLocations:    ["Oregon (us-west-2)", "N. California (us-west-1)"],
  },
  UNKNOWN: {
    region:           "UNKNOWN",
    allowedEndpoints: [],                 // DENY ALL — unknown origin blocked
    dataResidencyAct: "Default Deny",
    nodeLocations:    [],
  },
};

// ================================================================
// IP → REGION MAPPING
// Simulated: in production this calls a MaxMind GeoIP2 or AWS WAF
// ================================================================

// Deterministic region from IP for the simulation
function hashIpToRegion(ip: string): GeoRegion {
  const hash = crypto.createHash("md5").update(ip).digest("hex");
  const byte = parseInt(hash.slice(0, 2), 16); // 0-255

  if (byte < 64)  return "APAC";
  if (byte < 128) return "EU";
  if (byte < 192) return "US_EAST";
  return "US_WEST";
}

// Known test CIDR prefix → region overrides for deterministic demo
const KNOWN_PREFIXES: Array<{ prefix: string; region: GeoRegion }> = [
  { prefix: "103.",    region: "APAC"    },  // Malaysia/Singapore Telcos
  { prefix: "45.64",  region: "APAC"    },
  { prefix: "185.",   region: "EU"      },  // Common EU ranges
  { prefix: "178.",   region: "EU"      },
  { prefix: "52.20",  region: "US_EAST" },  // AWS US-East
  { prefix: "54.23",  region: "US_WEST" },
  { prefix: "127.",   region: "APAC"    },  // localhost → APAC (demo node)
  { prefix: "::1",    region: "APAC"    },  // IPv6 localhost → APAC
];

// ================================================================
// GEOLOCATION ROUTER
// ================================================================

export class GeolocationRouter {

  private blockedCrossings    = 0;
  private totalRequests       = 0;
  private violations: ResidencyViolation[] = [];

  // ── Core Methods ─────────────────────────────────────────────

  /**
   * Simulates a GeoIP lookup to map an IP address to a geographic region.
   */
  public detectRegion(ipAddress: string): GeoRegion {
    for (const { prefix, region } of KNOWN_PREFIXES) {
      if (ipAddress.startsWith(prefix)) return region;
    }
    return hashIpToRegion(ipAddress);
  }

  /**
   * Enforces data residency policy.
   * Throws a typed ResidencyViolation if the origin region is not
   * permitted to route data to the target model endpoint's region.
   *
   * @param originRegion   - Region detected from the request IP
   * @param targetRegion   - Region of the AI model endpoint selected by router
   * @returns GeoRoutingResult if allowed
   * @throws ResidencyViolation if blocked
   */
  public enforceResidency(
    originRegion:  GeoRegion,
    targetRegion:  GeoRegion,
  ): GeoRoutingResult {
    this.totalRequests++;

    const policy  = REGION_POLICIES[originRegion];
    const traceId = crypto.randomBytes(8).toString("hex").toUpperCase();
    const allowed = policy.allowedEndpoints.includes(targetRegion);

    if (!allowed) {
      this.blockedCrossings++;

      const violation: ResidencyViolation = {
        code:         "RESIDENCY_VIOLATION",
        originRegion,
        targetRegion,
        reason:       `${originRegion} data may not be processed by ${targetRegion} endpoints under ${policy.dataResidencyAct}`,
        regulation:   policy.dataResidencyAct,
        traceId,
        timestamp:    Date.now(),
      };

      this.violations.push(violation);
      console.error(
        `[V59:GeoRouter] 🚨 RESIDENCY_VIOLATION trace:${traceId} | ` +
        `${originRegion} → ${targetRegion} | BLOCKED | ${policy.dataResidencyAct}`
      );

      throw violation;
    }

    console.info(
      `[V59:GeoRouter] ✅ ALLOWED trace:${traceId} | ` +
      `${originRegion} → ${targetRegion} | ${policy.dataResidencyAct}`
    );

    return {
      originRegion,
      targetRegion,
      allowed: true,
      traceId,
      timestamp: Date.now(),
      regulationRef: policy.dataResidencyAct,
    };
  }

  /**
   * Convenience: detect the origin IP's region then enforce residency.
   * Called by proxyRoutes.ts with the raw request IP.
   */
  public enforceFromIP(
    ipAddress:    string,
    targetRegion: GeoRegion = "APAC",   // Default target is APAC node (demo config)
  ): GeoRoutingResult {
    const originRegion = this.detectRegion(ipAddress);
    return this.enforceResidency(originRegion, targetRegion);
  }

  // ── Telemetry ─────────────────────────────────────────────────

  public getBlockedCrossings(): number     { return this.blockedCrossings; }
  public getTotalRequests(): number        { return this.totalRequests; }
  public getViolations(): ResidencyViolation[] { return [...this.violations].reverse(); }
  public getPolicies(): RegionPolicy[]     { return Object.values(REGION_POLICIES); }

  public getCompliancePercent(): number {
    if (this.totalRequests === 0) return 100;
    return Math.round(((this.totalRequests - this.blockedCrossings) / this.totalRequests) * 100);
  }
}

// Singleton export
export const globalGeoRouter = new GeolocationRouter();
