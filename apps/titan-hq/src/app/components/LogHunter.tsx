"use client";

import { useEffect, useState, useRef } from "react";

// Placeholder for future HTTP log array endpoint — always empty until implemented
const EMPTY_LOGS: LogMessage[] = [];

export interface LogMessage {
  ts: string;
  level: string;
  msg: string;
  ctx?: Record<string, unknown>;
  err?: { name: string; message: string; stack?: string };
}

export function LogHunter() {
  const [isConnected, setIsConnected] = useState(false);
  const logs = EMPTY_LOGS;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pollTimer: NodeJS.Timeout;
    let mounted = true;

    async function pollLogs() {
      if (!mounted) return;
      try {
        const res = await fetch("/api/auth-token");
        const { token } = await res.json() as { token: string };
        
        const logRes = await fetch("http://localhost:4000/api/v1/bridge-hq/infra", {
          headers: { "x-titan-bridge-key": token }
        });
        
        if (mounted) setIsConnected(logRes.ok);
      } catch {
        if (mounted) setIsConnected(false);
      }
      if (mounted) pollTimer = setTimeout(pollLogs, 3000);
    }

    void pollLogs();
    return () => {
      mounted = false;
      clearTimeout(pollTimer);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function getLevelColor(level: string) {
    switch (level.toUpperCase()) {
      case "ERROR": return "text-red-400 font-bold";
      case "WARN": return "text-yellow-400 font-bold";
      case "INFO": return "text-cyan-400";
      case "DEBUG": return "text-zinc-500";
      default: return "text-zinc-300";
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <h3 className="text-zinc-300">The Log Hunter</h3>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">HTTP Polling</span>
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 animate-pulse"}`} />
        </div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto whitespace-pre h-[400px]">
        {logs.length === 0 ? (
           <div className="text-zinc-600 italic mt-2">Waiting for telemetry...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-1 leading-relaxed">
              <span className="text-zinc-500 mr-2">[{new Date(log.ts).toISOString().split('T')[1].replace('Z','')}]</span>
              <span className={`mr-2 ${getLevelColor(log.level)}`}>{log.level.toUpperCase().padEnd(5)}</span>
              <span className="text-zinc-300">{log.msg}</span>
              {log.ctx && <span className="text-zinc-500 ml-2">{JSON.stringify(log.ctx)}</span>}
              {log.err && <div className="pl-24 text-red-500 bg-red-950/20 p-2 mt-1 rounded whitespace-pre-wrap">{log.err.stack || log.err.message}</div>}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
