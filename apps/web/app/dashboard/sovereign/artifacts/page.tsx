"use client";

import React from "react";
import { SovereignArtifact } from "../../../../components/SovereignArtifact";

export default function ArtifactsDemoPage() {
  return (
    <div className="min-h-screen p-6 font-sans" style={{ background: "#050505", color: "#fff" }}>
      <div className="max-w-4xl mx-auto py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-mono font-bold">Sovereign Artifacts (Demo)</h1>
          <p className="text-sm text-gray-500">Verified security seals for agent outputs.</p>
        </div>

        <div className="space-y-6">
          <SovereignArtifact 
            title="Q3 Risk Exposure Analysis"
            type="DOCUMENT"
            execId="exec_9fa4b"
            agentName="Google Antigravity (MCP)"
            costSaved={0.412}
            merkleHash="sha256:7f3a9c2e1bd4"
            sciScore={99.93}
            timestamp="2026-03-22 14:02 UTC"
          />

          <SovereignArtifact 
            title="Generated Data Scrubbing Script"
            type="CODE"
            execId="exec_1b2c3"
            agentName="Cursor IDE Server"
            merkleHash="sha256:3d8f2a9c1e"
            sciScore={92.40}
            timestamp="2026-03-22 13:45 UTC"
          />
        </div>
      </div>
    </div>
  );
}
