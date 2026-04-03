import crypto from 'crypto';
import { db } from './db';

const MAX_RETRIES = 5;

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function sendWebhookWithRetry(url: string, payload: any, secret: string, retryCount = 0): Promise<void> {
  const payloadStr = JSON.stringify(payload);
  
  // Produce HMAC-SHA256 signature
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

  try {
    console.log(`[Dispatcher] 📡 Sending Webhook to ${url} (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
    
    // In actual node runtime, native fetch is available (Node 18+)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-streetmp-signature': signature
      },
      body: payloadStr,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`[Dispatcher] ✅ Webhook successfully delivered to ${url}`);

  } catch (error: any) {
    console.error(`[Dispatcher] ❌ Webhook delivery failed for ${url}: ${error.message}`);
    
    if (retryCount < MAX_RETRIES) {
      const backoffMs = Math.pow(2, retryCount) * 1000; // Exponential: 1s, 2s, 4s, 8s, 16s...
      console.log(`[Dispatcher] 🔄 Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
      return sendWebhookWithRetry(url, payload, secret, retryCount + 1);
    } else {
      console.error(`[Dispatcher] 🚨 Webhook permanently failed after ${MAX_RETRIES} retries for ${url}`);
    }
  }
}

export async function dispatchWebhook(workflow_id: string, execution_id: string, status: string, state_payload: any) {
  try {
    const webhooksRes = await db.query(
      `SELECT target_url, hmac_secret FROM external_webhooks 
       WHERE workflow_id = $1 AND is_active = true`,
      [workflow_id]
    );

    if (webhooksRes.rowCount === 0) return; // No targets to notify

    const hooks = webhooksRes.rows;
    console.log(`[Dispatcher] Found ${hooks.length} active webhooks for workflow ${workflow_id}. Dispatching...`);

    const webhookPayload = {
      execution_id,
      workflow_id,
      status, // 'completed' or 'failed'
      payload: state_payload
    };

    // Fire them concurrently
    const dispatchPromises = hooks.map(hook => {
      return sendWebhookWithRetry(hook.target_url, webhookPayload, hook.hmac_secret);
    });

    // We don't await this fully in the caller to avoid blocking the OS executor loop unnecessarily
    Promise.all(dispatchPromises).catch(e => console.error("[Dispatcher:Queue Error]", e));

  } catch (err: any) {
    console.error(`[Dispatcher] Failed to query webhooks: ${err.message}`);
  }
}
