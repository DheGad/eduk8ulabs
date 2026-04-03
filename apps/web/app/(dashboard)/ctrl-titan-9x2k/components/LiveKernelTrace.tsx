"use client";

import { useEffect, useState, useRef } from "react";
import { LogMessage } from "./types";

export function LiveKernelTrace() {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Determine the base WS URL based on the current domain
    const isLocal = window.location.hostname === "localhost";
    const wsProt = window.location.protocol === "https:" ? "wss:" : "ws:";
    // In prod, API route hits the same edge/load balancer. In local, we hit the router-service directly.
    const wsBase = isLocal ? "ws://localhost:4000" : `${wsProt}//${window.location.host}`;
    
    // Attempt connection
    const wsUrl = `${wsBase}/api/v1/ctrl-titan-9x2k/live-trace`;
    
    // We expect the Next.js API to pass DOWN the token, or we pull it from an env/cookie.
    // For the UI, we assume we fetch the admin secret to initiate the connection.
    let ws: WebSocket | null = null;

    async function initWs() {
      try {
        const res = await fetch("/api/ctrl-titan-9x2k/auth-token");
        const { token } = await res.json();
        
        ws = new WebSocket(wsUrl, [token]);
        
        ws.onopen = () => setIsConnected(true);
        ws.onclose = () => setIsConnected(false);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as LogMessage;
            setLogs(prev => {
              const newLogs = [...prev, data];
              return newLogs.slice(-100); // keep max 100 on frontend UI
            });
          } catch (e) {
            console.error("Failed to parse log message", e);
          }
        };
      } catch (err) {
        console.error("Failed to fetch WS auth token", err);
      }
    }

    initWs();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    // Auto-scroll Down
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function getLevelColor(level: string) {
    switch (level.toUpperCase()) {
      case "ERROR": return "text-red-400 font-bold";
      case "WARN": return "text-yellow-400 font-bold";
      case "INFO": return "text-cyan-400";
      case "DEBUG": return "text-zinc-400";
      default: return "text-zinc-300";
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <h3 className="text-zinc-300">Live Kernel Trace</h3>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">WebSocket</span>
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"}`} />
        </div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto overflow-x-auto whitespace-pre">
        {logs.length === 0 ? (
           <div className="text-zinc-600 italic mt-2">Waiting for telemetry...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-1 leading-relaxed">
              <span className="text-zinc-500 mr-2">[{new Date(log.ts).toISOString().split('T')[1].replace('Z','')}]</span>
              <span className={`mr-2 ${getLevelColor(log.level)}`}>{log.level.toUpperCase().padEnd(5)}</span>
              <span className="text-zinc-300">{log.msg}</span>
              {log.ctx && (
                <span className="text-zinc-500 ml-2">{JSON.stringify(log.ctx)}</span>
              )}
              {log.err && (
                <div className="pl-24 text-red-400/80 mt-1 whitespace-pre-wrap">{log.err.stack || log.err.message}</div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
