/**
 * @file server.ts
 * @package mcp-pro
 * @description Sovereign MCP Server (Model Context Protocol) 
 * 
 * Implements C055 Task 1.
 * 
 * The Model Context Protocol allows AI agents (like Google Antigravity, 
 * Cursor, Claude Desktop) to connect to StreetMP as a remote Resource/Tool.
 * 
 * Flow:
 * Agent IDE -> MCP Request -> StreetMP API Gateway -> Sovereign MCP Server
 * -> (PII Sanitizer & Enforcer check) -> Local Document/API Access -> Return safe context
 * 
 * Security: Everything read through this protocol is automatically sanitized.
 * External agents NEVER see the raw PII from the bank's database.
 */

import { EventEmitter } from "events";
import crypto from "crypto";

// ================================================================
// MCP PROTOCOL TYPES (Draft Implementation)
// ================================================================

export type McpMethod = 'mcp.initialize' | 'mcp.resources.list' | 'mcp.resources.read' | 'mcp.tools.list' | 'mcp.tools.execute' | 'mcp.prompts.list';

export interface McpRequest {
  id: string;
  method: McpMethod;
  params: any;
  client?: string;       // e.g. "Google Antigravity/1.0"
  agent_token?: string;  // API Key assigned to the agent
}

export interface McpResponse {
  id: string;
  result?: any;
  error?: { code: number; message: string };
}

// Allowed permissions per agent token
export interface AgentPermissions {
  can_read_docs: boolean;
  can_execute_tools: boolean;
  can_view_pii: boolean; // Almost always false in Sovereign mode
  allowed_resources: string[]; // e.g. ["db://transactions/*", "file:///compliance/*"]
}

// ================================================================
// SOVEREIGN MCP SERVER
// ================================================================
export class SovereignMcpServer extends EventEmitter {
  private agentStore: Map<string, AgentPermissions>;

  constructor() {
    super();
    this.agentStore = new Map();
    // Default mock configuration - in production fetched from PostgreSQL
    this.agentStore.set('antigravity_dev_token', {
      can_read_docs: true,
      can_execute_tools: true,
      can_view_pii: false,
      allowed_resources: ['cloud://streetmp/docs/api', 'db://vault/metadata']
    });
  }

  // Handle incoming JSON-RPC / MCP Request
  public async handleRequest(req: McpRequest): Promise<McpResponse> {
    const t0 = Date.now();
    
    // 1. Agent Authentication
    if (!req.agent_token || !this.agentStore.has(req.agent_token)) {
      return { id: req.id, error: { code: 401, message: "Unauthorized Agent Token" } };
    }
    const permissions = this.agentStore.get(req.agent_token)!;

    // 2. Dispatch Method
    let result: any;
    try {
      switch (req.method) {
        case 'mcp.initialize':
          result = this.handleInitialize(req.params);
          break;
        case 'mcp.resources.list':
          result = this.handleResourcesList(permissions);
          break;
        case 'mcp.resources.read':
          result = await this.handleResourcesRead(req.params, permissions);
          break;
        default:
          return { id: req.id, error: { code: 404, message: `Method ${req.method} not implemented` } };
      }
    } catch (e: any) {
      return { id: req.id, error: { code: 500, message: e.message } };
    }

    // 3. Telemetry hook for StreetMP dashboard
    this.emit("mcp_audit", {
      agent: req.client || "Unknown Agent",
      method: req.method,
      latency: Date.now() - t0,
      authorized: true
    });

    return { id: req.id, result };
  }

  private handleInitialize(params: any) {
    return {
      protocol_version: "1.0",
      server_info: {
        name: "StreetMP Sovereign MCP Server",
        version: "2.0.0",
        capabilities: {
          resources: { subscribe: true },
          tools: { execute: true },
          prompts: { list: true }
        }
      }
    };
  }

  private handleResourcesList(perms: AgentPermissions) {
    return {
      resources: [
        {
          uri: "streetmp://compliance/rbi_guidelines.md",
          name: "RBI Circular 2026 AI Guidelines",
          description: "Internal regulatory text",
          mimeType: "text/markdown"
        },
        {
          uri: "streetmp://vault/transaction_schema.json",
          name: "Core Banking Transaction Schema",
          description: "Schema required to format JSON tools",
          mimeType: "application/json"
        }
      ].map(r => ({
        ...r,
        allowed: perms.allowed_resources.includes('*') || perms.allowed_resources.some(ar => r.uri.startsWith(ar))
      }))
    };
  }

  private async handleResourcesRead(params: { uri: string }, perms: AgentPermissions) {
    if (!perms.can_read_docs) {
      throw new Error("Agent does not have the can_read_docs permission.");
    }

    // Mock fetching the document
    let content = `[INTERNAL METADATA] Requested URI: ${params.uri}\n\n`;
    content += `The transaction involved Customer John Doe (Account: 00412349871, IP: 192.168.1.44).\n`;
    
    // SOVEREIGN INTERVENTION: If the agent cannot view PII, sanitize the document on the fly BEFORE it leaves the MCP gateway
    if (!perms.can_view_pii) {
      // Typically we'd call the ZK Sanitizer here. Simulating the result:
      content = content.replace("John Doe", "[PERSON_X1]");
      content = content.replace("00412349871", "[ACCOUNT_MASKED]");
      content = content.replace("192.168.1.44", "[IP_ADDR_MASKED]");
      content = `[STREETMP SANITIZER ACTIVE — PII REMOVED]\n${content}`;
    }

    // Generate Merkle hash for the document delivery
    const docHash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      contents: [
        {
          uri: params.uri,
          mimeType: "text/plain",
          text: content,
          streetmp_audit_hash: docHash // StreetMP extension
        }
      ]
    };
  }
}

// Singleton for immediate use
export const mcpServer = new SovereignMcpServer();
