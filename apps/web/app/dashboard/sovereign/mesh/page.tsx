"use client";

import React, { useRef, useEffect, useState } from "react";

// ================================================================
// NEURAL MESH VISUALIZER — RAG 4.0 Reasoning Chain
// Interactive Canvas-based animation showing the invisible reasoning.
// ================================================================

type NodeType = "query" | "vector" | "graph" | "enforcer" | "output";

interface MeshNode {
  id: string;
  label: string;
  sublabel: string;
  type: NodeType;
  x: number;
  y: number;
  radius: number;
  color: string;
  ring: string;
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  fromId: string;
  toId: string;
}

const NODES: Omit<MeshNode, "active">[] = [
  { id: "query", label: "Query Engine", sublabel: "User Prompt", type: "query", x: 0.12, y: 0.5, radius: 30, color: "#7C3AED", ring: "#A78BFA" },
  { id: "vector", label: "Dense Vector", sublabel: "Semantic Search", type: "vector", x: 0.35, y: 0.22, radius: 24, color: "#0EA5E9", ring: "#38BDF8" },
  { id: "sparse", label: "BM25 Sparse", sublabel: "Keyword Match", type: "vector", x: 0.35, y: 0.5, radius: 24, color: "#0284C7", ring: "#38BDF8" },
  { id: "graph", label: "Entity Graph", sublabel: "Relationships", type: "graph", x: 0.35, y: 0.78, radius: 24, color: "#0369A1", ring: "#38BDF8" },
  { id: "rrf", label: "RRF Fusion", sublabel: "Score: 0.997", type: "graph", x: 0.56, y: 0.5, radius: 28, color: "#D97706", ring: "#FCD34D" },
  { id: "enforcer", label: "Enforcer", sublabel: "Policy + Schema", type: "enforcer", x: 0.77, y: 0.5, radius: 30, color: "#DC2626", ring: "#F87171" },
  { id: "output", label: "Signed Output", sublabel: "Proof Attached", type: "output", x: 0.92, y: 0.5, radius: 28, color: "#10B981", ring: "#6EE7B7" },
];

const EDGES = [
  { from: "query", to: "vector" },
  { from: "query", to: "sparse" },
  { from: "query", to: "graph" },
  { from: "vector", to: "rrf" },
  { from: "sparse", to: "rrf" },
  { from: "graph", to: "rrf" },
  { from: "rrf", to: "enforcer" },
  { from: "enforcer", to: "output" },
];

export default function NeuralMeshPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let time = 0;
    let activeIdx = 0;
    const stepSequence = ["query", "vector", "sparse", "graph", "rrf", "enforcer", "output"];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const getPos = (node: Omit<MeshNode, "active">) => ({
      x: node.x * canvas.offsetWidth,
      y: node.y * canvas.offsetHeight
    });

    function spawnParticle(fromId: string, toId: string) {
      const from = NODES.find(n => n.id === fromId);
      const to = NODES.find(n => n.id === toId);
      if (!from || !to) return;
      const fromPos = getPos(from);
      const toPos = getPos(to);
      particles.push({
        x: fromPos.x, y: fromPos.y,
        targetX: toPos.x, targetY: toPos.y,
        progress: 0,
        speed: 0.015 + Math.random() * 0.01,
        fromId, toId
      });
    }

    function draw() {
      if (!canvas) return;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (!ctx) return; // Added this line as per instruction
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Modified this line as per instruction

      // Background grid
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();

      // Edges
      EDGES.forEach(({ from, to }) => {
        const fNode = NODES.find(n => n.id === from);
        const tNode = NODES.find(n => n.id === to);
        if (!fNode || !tNode) return;
        const fp = getPos(fNode);
        const tp = getPos(tNode);
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fp.x, fp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
        ctx.restore();
      });

      // Particles
      particles = particles.filter(p => p.progress < 1);
      particles.forEach(p => {
        p.progress = Math.min(p.progress + p.speed, 1);
        p.x = p.x + (p.targetX - p.x) * p.speed * 8;
        p.y = p.y + (p.targetY - p.y) * p.speed * 8;
        ctx.save();
        ctx.fillStyle = "#10B981";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#10B981";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Nodes
      NODES.forEach(node => {
        const pos = getPos(node);
        const isActive = node.id === stepSequence[activeIdx];

        // Outer glow ring
        if (isActive) {
          const grd = ctx.createRadialGradient(pos.x, pos.y, node.radius * 0.8, pos.x, pos.y, node.radius * 2.5);
          grd.addColorStop(0, node.color + "44");
          grd.addColorStop(1, "transparent");
          ctx.save();
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, node.radius * 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Node body
        ctx.save();
        ctx.fillStyle = node.color + (isActive ? "cc" : "55");
        ctx.strokeStyle = isActive ? node.ring : node.color + "44";
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.shadowBlur = isActive ? 25 : 5;
        ctx.shadowColor = node.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Node label
        ctx.save();
        ctx.fillStyle = isActive ? "#fff" : "#888";
        ctx.font = `bold ${node.radius > 25 ? 11 : 9}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.label, pos.x, pos.y - 4);
        ctx.fillStyle = isActive ? "#aaa" : "#555";
        ctx.font = `8px monospace`;
        ctx.fillText(node.sublabel, pos.x, pos.y + 7);
        ctx.restore();
      });

      time++;

      // Advance step every 100 frames
      if (time % 80 === 0) {
        activeIdx = (activeIdx + 1) % stepSequence.length;
        setActiveStep(stepSequence[activeIdx]);

        // Spawn particles along relevant edges
        EDGES.filter(e => e.from === stepSequence[activeIdx]).forEach(e => {
          spawnParticle(e.from, e.to);
        });

        setConfidence(Math.min(100, Math.round(60 + activeIdx * 6)));
      }

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#050505] p-6 font-sans">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-mono font-bold text-white tracking-tight">Neural Mesh Visualizer</h1>
          <p className="text-[#888] text-sm mt-1">Make the invisible reasoning visible. RAG 4.0 in real-time.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <p className="text-[10px] font-mono text-[#666] uppercase tracking-widest">Consensus Score</p>
            <p className="text-3xl font-mono font-bold text-emerald-500">{confidence}%</p>
          </div>
          <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-xs font-mono font-bold tracking-widest uppercase">
            {activeStep?.toUpperCase() || "IDLE"}
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-2xl border border-[#1a1a1a] overflow-hidden relative">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        {[
          { label: "Retrieval Sources", value: "3" },
          { label: "RRF Score", value: "0.997" },
          { label: "Policy Gate", value: "PASSED" },
          { label: "Signed Receipt", value: "YES" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 text-center">
            <p className="text-[10px] text-[#666] font-mono uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-lg font-mono font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
