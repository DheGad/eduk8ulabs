# StreetMP Edge Shield: Integration Manifest

**Zero-Knowledge Client-Side SDK**  
Target API: `@streetmp/edge-shield`

---

## 1. The Threat Vector
When your employees type instructions into internal portals (e.g., "Review mortgage application for Mark Spector, SSN: 123-45-7890"), transferring this payload across internal networks inherently generates regulatory liability.  

The **StreetMP Edge Shield** intercepts prompts directly at the V8 engine level (React/Browser), scrubs all critical PII, generates a temporary memory dictionary, and transmits only secure deterministic tokens `[PERSON_X1]`, `[SSN_X1]`. The server never sees the raw data. The mapping dictionary lives strictly in your employees' volatile RAM.

## 2. Installation

Bank IT Frontend developers must run:

```bash
npm install @streetmp/edge-shield
```

## 3. Integration in 3 Lines of Code

Integrate the **Edge Re-Identifier Hook** into your specific frontend component:

```tsx
import { useState } from 'react';
import { useZeroTrustEdge } from '@streetmp/edge-shield/hooks';

export function EmployeeTerminal() {
  const [input, setInput] = useState("");
  
  // Line 1 & 2: Initialize zero-trust SDK hook
  const { executePrompt, isProcessing, response, error } = useZeroTrustEdge({
    endpoint: process.env.NEXT_PUBLIC_KERNEL_URL,
    apiKey: process.env.NEXT_PUBLIC_STREETMP_API_KEY
  });

  const handleAction = async () => {
    // Line 3: Fire & forget. All logic is obfuscated and mapped invisibly.
    await executePrompt(input);
  };

  return (
    <div className="terminal-ui">
      <input type="text" onChange={(e) => setInput(e.target.value)} />
      <button onClick={handleAction} disabled={isProcessing}>
        {isProcessing ? "Processing (Zero-Knowledge)..." : "Execute command"}
      </button>

      {error && <div className="error">{error}</div>}
      
      {/* Response naturally renders with true identities restored local-only */}
      {response && <div className="terminal-output">{response}</div>}
    </div>
  );
}
```

### Safety Guarantees
- The dictionary mapping object lives inside a scoped Javascript closure (`EdgeSanitizer` execution context) and is instantly garbage collected when the component unmounts.
- It is physically impossible for the StreetMP Enterprise Kernel docker container (the "Server") to leak your PII, because it mathematically does not exist on the server.
