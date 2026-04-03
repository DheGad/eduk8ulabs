/**
 * @file prefetch.ts
 * @package workflow-service
 * @description Autonomous Pre-Caching ("The Mind Reader")
 *
 * Monitors workflow execution state. If a user is on Step N, the Engine
 * spins up background workers to prospectively simulate and cache
 * Step N+1, N+2, etc., before the user even triggers them.
 */

export interface WorkflowDefinition {
  id: string;
  steps: Array<{
    step_id: string;
    prompt_template: string;
    target_model: string;
    required_keys: string[];
    depends_on: string[];
  }>;
}

export interface ExecutionState {
  workflow_id: string;
  execution_id: string;
  current_step: string;
  completed_steps: Record<string, any>; // outputs of previous steps
}

export class PredictivePrefetcher {
  private cache = new Map<string, any>(); // Map<execution_id + step_id, pre_computed_output>

  /**
   * Called whenever a step completes successfully.
   * Finds downstream steps whose dependencies are now met and executes them
   * prospectively in the background via the Enforcer Service.
   */
  public triggerPrecachLoop(def: WorkflowDefinition, state: ExecutionState): void {
    console.log(`[Prefetcher] Triggering autonomous pre-cache loop for execution ${state.execution_id}...`);

    // Find steps that haven't run yet, but all their dependencies are in `completed_steps`
    const eligibleSteps = def.steps.filter(step => {
      // Skip if already completed
      if (state.completed_steps[step.step_id]) return false;
      // Skip if already in cache (we already pre-fetched it)
      if (this.cache.has(`${state.execution_id}:${step.step_id}`)) return false;

      // Check deps
      const depsMet = step.depends_on.every(dep => !!state.completed_steps[dep]);
      return depsMet;
    });

    if (eligibleSteps.length === 0) {
      console.log(`[Prefetcher] No eligible downstream steps for pre-fetching.`);
      return;
    }

    // Fire background simulations
    for (const step of eligibleSteps) {
      console.log(`[Prefetcher] 🔮 Simulating Step [${step.step_id}] in the background...`);
      
      this.simulateStep(state.execution_id, step, state.completed_steps).catch(err => {
        console.warn(`[Prefetcher] Background simulation for ${step.step_id} failed (silently dropped):`, err.message);
      });
    }
  }

  /**
   * Simulates reaching out to the Enforcer Service exactly as standard execution would,
   * but operates completely asynchronously.
   */
  private async simulateStep(executionId: string, step: any, previousOutputs: Record<string, any>): Promise<void> {
    // 1. Fill prompt template with previous outputs
    let compiledPrompt = step.prompt_template;
    for (const [key, val] of Object.entries(previousOutputs)) {
      compiledPrompt = compiledPrompt.replace(`{{${key}}}`, JSON.stringify(val));
    }

    // 2. Artificial delay to represent Enforcer/LLM I/O
    await new Promise(res => setTimeout(res, 2000 + Math.random() * 3000));

    // 3. Mock success payload from Enforcer
    const precomputedOutput = {
      _prefetched: true,
      timestamp: Date.now(),
      status: "synthesized_background"
    };

    // 4. Store in Cache
    const cacheKey = `${executionId}:${step.step_id}`;
    this.cache.set(cacheKey, precomputedOutput);
    
    console.log(`[Prefetcher] ✅ Step [${step.step_id}] successfully pre-cached! Ready for instant UI delivery.`);
  }

  /**
   * During actual execution, Workflow Service checks here first.
   * If it's a cache hit, the user experiences 0ms LLM latency.
   */
  public getCachedStep(executionId: string, stepId: string): any | null {
    const key = `${executionId}:${stepId}`;
    if (this.cache.has(key)) {
      console.log(`[Prefetcher] ⚡ CACHE HIT for ${key}! Zero-latency step execution.`);
      const data = this.cache.get(key);
      this.cache.delete(key); // Evict after read
      return data;
    }
    return null;
  }
}

export const prefetcher = new PredictivePrefetcher();
