import { useState, useCallback, useMemo } from 'react';
import { StreetMPClient } from './client';
import { EdgeSanitizer } from './sanitizer';

export interface UseZeroTrustOptions {
  endpoint: string;
  apiKey: string;
}

/**
 * THE "RE-IDENTIFIER" HOOK
 * Safely maps real names back into UI State using locally scoped RAM mappings.
 * Mapping never leaves the client VM.
 */
export function useZeroTrustEdge({ endpoint, apiKey }: UseZeroTrustOptions) {
  const client = useMemo(() => new StreetMPClient(endpoint, apiKey), [endpoint, apiKey]);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executePrompt = useCallback(async (instruction: string) => {
    setIsProcessing(true);
    setError(null);
    setResponse(null);
    
    try {
      // The client returns the raw (masked) AI response & our local dictionary map
      const { rawResponse, mapping } = await client.submitPrompt(instruction);

      // Perform re-identification entirely locally before state render
      const plainTextResponse = EdgeSanitizer.unmask(rawResponse, mapping);
      
      setResponse(plainTextResponse);
      return plainTextResponse;
      
    } catch (err: any) {
      setError(err.message || 'Unknown Edge Network Error');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [client]);

  return { 
    executePrompt, 
    isProcessing, 
    response, 
    error 
  };
}
