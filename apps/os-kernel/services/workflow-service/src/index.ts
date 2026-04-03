import express from 'express';
import cors from 'cors';
import { db } from './db';
import { executeWorkflow } from './runner';
import { a2aRouter } from './a2aRoutes';
import { equityRouter } from './equityRoutes';
import { startAnomalyDetector } from './monitor';
import { publicApiRouter } from './publicApi';

// Initialize the OS Singularity Engine (Auto-Tuner Monitor)
startAnomalyDetector();

const app = express();
app.use(express.json());
app.use(cors());

app.use(a2aRouter);
app.use(equityRouter);
app.use(publicApiRouter);

// POST /api/v1/workflows (Create DAG pipeline)
app.post('/api/v1/workflows', async (req, res) => {
  try {
    const { user_id, organization_id, workflow_name, nodes, edges } = req.body;
    
    if (!user_id || !organization_id || !workflow_name || !nodes || !edges) {
      return res.status(400).json({ error: 'Missing required fields for DAG definition.' });
    }

    const result = await db.query(
      `INSERT INTO autonomous_workflows (user_id, organization_id, workflow_name, nodes, edges) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [user_id, organization_id, workflow_name, JSON.stringify(nodes), JSON.stringify(edges)]
    );

    res.status(201).json({ 
      success: true, 
      workflow_id: result.rows[0].id,
      message: 'Autonomous DAG workflow created.'
    });
  } catch (err: any) {
    console.error('Error creating workflow:', err);
    res.status(500).json({ error: 'Failed to create workflow.' });
  }
});

// POST /api/v1/workflows/:id/execute (Trigger pipeline)
app.post('/api/v1/workflows/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if workflow exists
    const wf = await db.query('SELECT * FROM autonomous_workflows WHERE id = $1', [id]);
    if (wf.rowCount === 0) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }

    // Create Execution Record
    const execResult = await db.query(
      `INSERT INTO workflow_executions (workflow_id, status, state_payload) 
       VALUES ($1, 'running', '{}') RETURNING id`,
       [id]
    );
    
    const execution_id = execResult.rows[0].id;

    // Fire off async runner
    executeWorkflow(execution_id);

    res.status(202).json({
      success: true,
      execution_id,
      message: 'DAG Execution initialized asynchronously.'
    });
  } catch (err: any) {
    console.error('Error executing workflow:', err);
    res.status(500).json({ error: 'Failed to trigger execution.' });
  }
});

// GET /api/v1/workflows/:id
app.get('/api/v1/workflows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const wf = await db.query('SELECT * FROM autonomous_workflows WHERE id = $1', [id]);
    if (wf.rowCount === 0) return res.status(404).json({ error: 'Workflow not found' });
    res.json({ workflow: wf.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// GET /api/v1/executions/:id
app.get('/api/v1/executions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const wf = await db.query('SELECT status, current_node, cumulative_cost, state_payload FROM workflow_executions WHERE id = $1', [id]);
    if (wf.rowCount === 0) return res.status(404).json({ error: 'Execution not found' });
    res.json(wf.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// GET /api/v1/workflows/store
app.get('/api/v1/workflows/store', async (req, res) => {
  try {
    const wf = await db.query(
      `SELECT aw.*, users.current_hcq_score as creator_hcq
       FROM autonomous_workflows aw
       JOIN users ON aw.user_id = users.id
       WHERE is_published = true 
       ORDER BY total_rentals DESC`
    );
    res.json({ workflows: wf.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

// POST /api/v1/workflows/:id/publish
app.post('/api/v1/workflows/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const { price_per_execution, description } = req.body;
    
    const wf = await db.query(
      `UPDATE autonomous_workflows 
       SET is_published = true, price_per_execution = $1, description = $2 
       WHERE id = $3 RETURNING *`,
      [price_per_execution || 0, description || '', id]
    );

    if (wf.rowCount === 0) return res.status(404).json({ error: 'Workflow not found.' });

    res.json({ success: true, workflow: wf.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish workflow' });
  }
});

const PORT = process.env.PORT || 4009;
app.listen(PORT, () => {
  console.log(`🚀 [Workflow Service] Agentic Orchestrator live on port ${PORT}`);
});
