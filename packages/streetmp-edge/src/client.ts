import { EdgeSanitizer, SanitizedPayload } from './sanitizer';

/**
 * The Secure Transport Client
 * Intercepts requests, delegates to EdgeSanitizer, and transports solely obfuscated strings.
 */
export class StreetMPClient {
  private endpoint: string;
  private apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  /**
   * Submits a prompt to the StreetMP Enterprise Node.
   * Only the safely masked payload leaves the network edge.
   */
  async submitPrompt(prompt: string): Promise<{ rawResponse: string; mapping: Record<string, string> }> {
    // 1. Sanitize in volatile RAM
    const { text: maskedPrompt, mapping }: SanitizedPayload = EdgeSanitizer.mask(prompt);

    // 2. Transmit masked intent over the wire
    const response = await fetch(`${this.endpoint}/api/v1/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ 
        prompt: maskedPrompt,
        zerotrust: true 
      })
    });

    if (!response.ok) {
      throw new Error(`StreetMP Edge Protocol Error. Status: ${response.status}`);
    }

    const data = await response.json();

    // 3. Return the AI's masked response along with our volatile map array
    return {
      rawResponse: data.response || data.result,
      mapping
    };
  }
}
