/**
 * @file src/index.ts
 * @package @streetmp/sdk
 * @description Public barrel export — everything a consumer needs.
 */

export { StreetMPClient }                           from "./StreetMPClient.js";
export { detectLocalPii }                           from "./localPiiGuard.js";
export type {
  StreetMPClientOptions,
  ChatMessage,
  MessageRole,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChoice,
  ChatCompletionUsage,
  STPVerifyResult,
  PartnerBrand,
}                                                   from "./types.js";
export { StreetMPError, StreetMPPiiError, StreetMPTimeoutError } from "./types.js";
