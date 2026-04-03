import { randomUUID } from "node:crypto";
import { globalVault, MOCK_CLIENT_KEY, SealedPayload } from "../vaultManager.js";

/**
 * @file conversationService.ts
 * @service router-service
 * @description Command 091 — The Sovereign AI Workspace 
 * Uses V47 Tenant-Key logic (imported from vaultManager) to encrypt message_content at rest.
 */

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;         // Plaintext in memory, sealed in DB
  timestamp: string;
  stpPayload?: any;
  trustScore?: number;
  certHash?: string;
  nemoVerified?: boolean;
}

export interface Conversation {
  id: string;
  tenantId: string;
  title: string;
  updatedAt: string;
}

// In-Memory map to simulate DB rows (encrypted blobs)
const CONVERSATION_DB = new Map<string, SealedPayload>();
const MESSAGE_DB = new Map<string, SealedPayload[]>(); // convId -> array of sealed messages

export class ConversationService {
  
  public createConversation(tenantId: string, title?: string): Conversation {
    const conv: Conversation = {
      id: randomUUID(),
      tenantId,
      title: title || "New Sovereign Workspace",
      updatedAt: new Date().toISOString()
    };
    
    // Encrypt at rest via V47 Vault Logic
    const sealed = globalVault.sealData(conv, MOCK_CLIENT_KEY);
    CONVERSATION_DB.set(conv.id, sealed);
    MESSAGE_DB.set(conv.id, []);
    
    return conv;
  }

  public getConversationsByTenant(tenantId: string): Conversation[] {
    const arr: Conversation[] = [];
    for (const [id, sealed] of CONVERSATION_DB.entries()) {
      try {
        const decrypted = globalVault.unsealData(sealed, MOCK_CLIENT_KEY) as Conversation;
        if (decrypted.tenantId === tenantId) {
          arr.push(decrypted);
        }
      } catch (err) {
        // Unseal failed or key revoked
      }
    }
    return arr.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public saveMessage(tenantId: string, convId: string, message: Omit<ChatMessage, "id" | "conversationId" | "timestamp">): ChatMessage {
    const sealedConv = CONVERSATION_DB.get(convId);
    if (!sealedConv) throw new Error("Conversation not found");

    // Enforce Isolation
    const conv = globalVault.unsealData(sealedConv, MOCK_CLIENT_KEY) as Conversation;
    if (conv.tenantId !== tenantId) throw new Error("V47 Integrity: Tenant Bleed Blocked");

    const fullMessage: ChatMessage = {
      ...message,
      id: randomUUID(),
      conversationId: convId,
      timestamp: new Date().toISOString()
    };

    // Auto update title if first message
    const msgArray = MESSAGE_DB.get(convId) || [];
    if (msgArray.length === 0 && message.role === "user") {
      conv.title = message.content.length > 30 ? message.content.substring(0, 30) + "..." : message.content;
      conv.updatedAt = new Date().toISOString();
      CONVERSATION_DB.set(convId, globalVault.sealData(conv, MOCK_CLIENT_KEY));
    }

    // Encrypt message content via V47 Storage Vaults
    const sealedMsg = globalVault.sealData(fullMessage, MOCK_CLIENT_KEY);
    msgArray.push(sealedMsg);
    MESSAGE_DB.set(convId, msgArray);

    console.info(`[V47:Vault] 🔐 Message securely encrypted and stored for Tenant ${tenantId}`);

    return fullMessage;
  }

  public getMessages(tenantId: string, convId: string): ChatMessage[] {
    const sealedConv = CONVERSATION_DB.get(convId);
    if (!sealedConv) return [];

    const conv = globalVault.unsealData(sealedConv, MOCK_CLIENT_KEY) as Conversation;
    if (conv.tenantId !== tenantId) return []; // Block tenant bleed

    const arr = MESSAGE_DB.get(convId) || [];
    return arr.map(sealed => globalVault.unsealData(sealed, MOCK_CLIENT_KEY) as ChatMessage);
  }
}

export const globalConversationService = new ConversationService();
