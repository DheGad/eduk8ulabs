import { Request, Response } from 'express';
import { Redis } from 'ioredis';

// Ensure your local .env has STREETMP_ADMIN_SECRET and REDIS_URL
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const ADMIN_SECRET = process.env.STREETMP_ADMIN_SECRET || 'dev_admin_secret_key';

// Blended average cost: $0.005 per 1,000 tokens
const BLENDED_COST_PER_1K_TOKENS = 0.005;

export const getUsageAnalytics = async (req: Request, res: Response) => {
  try {
    // 1. The Hard Gate
    const providedSecret = req.headers['x-admin-secret'];
    if (!providedSecret || providedSecret !== ADMIN_SECRET) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing Admin Secret.'
      });
    }

    // 2. Non-Blocking Redis Aggregation
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const matchPattern = `quota:monthly:*:${currentMonth}`;
    
    const keys: string[] = [];
    const stream = redis.scanStream({ match: matchPattern, count: 100 });

    stream.on('data', (resultKeys: string[]) => {
      keys.push(...resultKeys);
    });

    stream.on('end', async () => {
      if (keys.length === 0) {
        return res.status(200).json({ success: true, timestamp: new Date(), data: [] });
      }

      // Fetch all token counts in a single pipeline
      const pipeline = redis.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      // 3. Financial Mapping
      const analyticsData = keys.map((key, index) => {
        // Extract tenantId from quota:monthly:tenant-id:YYYY-MM
        const parts = key.split(':');
        const tenantId = parts.slice(2, -1).join(':'); 
        
        const rawValue = results?.[index]?.[1];
        const usedTokens = parseInt(rawValue as string, 10) || 0;
        
        // Calculate estimated USD cost
        const estimatedCostUSD = (usedTokens / 1000) * BLENDED_COST_PER_1K_TOKENS;

        return {
          tenantId,
          usedTokens,
          estimatedCostUSD: parseFloat(estimatedCostUSD.toFixed(4))
        };
      });

      // Sort by highest burn rate
      analyticsData.sort((a, b) => b.usedTokens - a.usedTokens);

      // 4. Return Payload
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        totalTenantsActive: analyticsData.length,
        globalTokensUsed: analyticsData.reduce((acc, curr) => acc + curr.usedTokens, 0),
        data: analyticsData
      });
    });

  } catch (error) {
    console.error('[V61] Telemetry Engine Error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error during telemetry aggregation.' });
  }
};
