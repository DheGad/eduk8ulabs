/**
 * @file gpuManager.ts
 * @service router-service
 * @version V100-MAX
 * @description Hardware Acceleration Matrix — Scans for NVIDIA/AMD GPUs
 * and provides real-time VRAM allocation and temperature metrics.
 */

import { exec } from "child_process";
import fs from "fs";

export interface GpuMetrics {
  detected: boolean;
  vendor?: "NVIDIA" | "AMD" | "UNKNOWN";
  model?: string;
  vramUsedMB?: number;
  vramTotalMB?: number;
  temperatureC?: number;
  error?: string;
}

export class GpuManager {
  private static instance: GpuManager;
  private hasNvidia: boolean = false;
  private hasAmd: boolean = false;

  private constructor() {
    this.hasNvidia = fs.existsSync("/dev/nvidia0");
    this.hasAmd = fs.existsSync("/dev/kfd");
  }

  public static getInstance(): GpuManager {
    if (!GpuManager.instance) {
      GpuManager.instance = new GpuManager();
    }
    return GpuManager.instance;
  }

  public async getMetrics(): Promise<GpuMetrics> {
    if (this.hasNvidia) {
      return this.getNvidiaMetrics();
    }
    
    if (this.hasAmd) {
      // Stub for AMD ROCm / rocm-smi
      return {
        detected: true,
        vendor: "AMD",
        model: "Instinct/Radeon",
        vramUsedMB: 0,
        vramTotalMB: 0,
        temperatureC: 0,
        error: "AMD parsing not fully implemented",
      };
    }

    return {
      detected: false,
    };
  }

  private getNvidiaMetrics(): Promise<GpuMetrics> {
    return new Promise((resolve) => {
      // Query VRAM used, Total, and Temp.
      const cmd = `nvidia-smi --query-gpu=name,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits`;
      
      exec(cmd, (error, stdout) => {
        if (error) {
          return resolve({
            detected: true,
            vendor: "NVIDIA",
            error: "nvidia-smi failed or unavailable in container",
          });
        }

        try {
          const lines = stdout.trim().split("\\n");
          if (lines.length === 0) throw new Error("No output");
          
          const [name, usedStr, totalStr, tempStr] = lines[0].split(",").map(s => s.trim());
          
          resolve({
            detected: true,
            vendor: "NVIDIA",
            model: name,
            vramUsedMB: parseInt(usedStr, 10),
            vramTotalMB: parseInt(totalStr, 10),
            temperatureC: parseInt(tempStr, 10),
          });
        } catch (err: any) {
          resolve({
            detected: true,
            vendor: "NVIDIA",
            error: err.message,
          });
        }
      });
    });
  }
}

export const gpuManager = GpuManager.getInstance();
