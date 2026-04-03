/**
 * @file controllers/overrideController.ts
 * @service router-service
 * @phase Phase 6 — Titan Hardening
 * @description
 *   Highly privileged Global Override API.
 *   Uses child_process.exec to run system-level shell scripts.
 *   Strictly guarded by ctrlRouteGuard and adminSecretGuard.
 */

import { Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { log } from "../utils/logger.js";

const execAsync = promisify(exec);

// Assuming project root is 4 directories up from here (src/controllers -> src -> router-service -> services -> os-kernel...)
// Actually, looking at the layout: apps/os-kernel/services/router-service/src/controllers
// Project root = ../../../../..
const PROJECT_ROOT = path.resolve(import.meta.dirname ?? process.cwd(), "../../../../..");

export async function runTitanBackup(req: Request, res: Response) {
  try {
    const scriptPath = path.join(PROJECT_ROOT, "titan-backup.sh");
    log.info("Titan Override Triggered: Backup", { script: scriptPath });

    const { stdout, stderr } = await execAsync(`bash ${scriptPath}`, {
      cwd: PROJECT_ROOT,
      env: process.env // pass through all envs
    });

    res.json({ success: true, stdout, stderr });
  } catch (err: any) {
    log.error("Titan Override Failed: Backup", err);
    res.status(500).json({ success: false, error: err.message, stderr: err.stderr, stdout: err.stdout });
  }
}

export async function runV1Audit(req: Request, res: Response) {
  try {
    const scriptPath = path.join(PROJECT_ROOT, "v1-audit-check.ts");
    log.info("Titan Override Triggered: V1 Audit", { script: scriptPath });

    const { stdout, stderr } = await execAsync(`npx tsx ${scriptPath}`, {
      cwd: PROJECT_ROOT,
      env: process.env
    });

    res.json({ success: true, stdout, stderr });
  } catch (err: any) {
    log.error("Titan Override Failed: V1 Audit", err);
    // Even if it fails (exit code 1), we want to return the output so the UI can show the red Xs
    res.json({ success: false, output: err.stdout + "\n" + err.stderr, error: err.message });
  }
}
