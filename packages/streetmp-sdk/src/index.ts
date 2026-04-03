import OpenAI, { ClientOptions } from "openai";
import { __VERSION__ } from "./version";

export interface StreetMPOptions extends ClientOptions {
  /**
   * If true, prevents the SDK from automatically routing requests
   * through the StreetMP AI Gateway (`https://api.streetmp.com/v1`).
   * This is generally not recommended, as it bypasses the audit ledger,
   * PII scrubbing, and Smart Escrow routing.
   *
   * @default false
   */
  dangerouslyAllowCustomEndpoint?: boolean;
}

/**
 * StreetMP OS - Zero-Change AI Gateway SDK.
 *
 * This SDK is a drop-in replacement for the official `openai` Node package.
 * It automatically routes all AI traffic through your isolated StreetMP Vault,
 * guaranteeing instantaneous compliance logging, Merkle audits, and PII masking
 * without any adjustments to standard streaming or completion code.
 */
export class StreetMP extends OpenAI {
  constructor(options: StreetMPOptions = {}) {
    // Determine the base URL. If the user provided a custom baseURL but didn't
    // explicitly allow it, we rewrite it to the StreetMP gateway to ensure compliance.
    const customEndpointOverride = options.dangerouslyAllowCustomEndpoint === true;

    // Use StreetMP Gateway by default.
    let resolvedBaseURL = "https://api.streetmp.com/v1";

    if (customEndpointOverride && options.baseURL) {
      resolvedBaseURL = options.baseURL;
    } else if (process.env.STREETMP_API_URL) {
      // Support environment variable overrides for local proxy tests
      resolvedBaseURL = process.env.STREETMP_API_URL;
    }

    // Merge standard options with our defaults
    const augmentedOptions: ClientOptions = {
      ...options,
      baseURL: resolvedBaseURL,
      defaultHeaders: {
        ...options.defaultHeaders,
        "X-StreetMP-SDK-Version": __VERSION__,
        "X-StreetMP-Client": "Node",
      },
    };

    super(augmentedOptions);
  }
}

// Re-export OpenAI classes/types so this is a true drop-in replacement
export * from "openai";
export default StreetMP;
