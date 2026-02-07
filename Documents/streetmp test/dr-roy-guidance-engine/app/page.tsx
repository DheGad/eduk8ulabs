"use client";

import Hero from "@/components/Hero";
import ToolGrid from "@/components/ToolGrid";
import Insights from "@/components/Insights";
import Contact from "@/components/Contact";
import ReportPreview from "@/components/ReportPreview"; // Import
import Lab from "@/components/Lab"; // Import
import Dock from "@/components/layout/Dock";
import { useUIStore } from "@/store/uiStore";
import { AnimatePresence, motion } from "framer-motion";

export default function Home() {
  const { currentView } = useUIStore();

  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500/30 overflow-hidden font-sans">
      {/* Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
      </div>

      <AnimatePresence mode="wait">
        {currentView === 'hero' && (
          <motion.div key="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <Hero />
          </motion.div>
        )}
        {currentView === 'grid' && (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <ToolGrid />
          </motion.div>
        )}
        {currentView === 'insights' && (
          <motion.div key="insights" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ duration: 0.5 }}>
            <Insights />
          </motion.div>
        )}
        {currentView === 'contact' && (
          <motion.div key="contact" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.5 }} className="pt-24 px-4 flex justify-center">
            <Contact />
          </motion.div>
        )}
        {currentView === 'report-preview' && (
          <motion.div key="report-preview" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} transition={{ duration: 0.5 }}>
            <ReportPreview />
          </motion.div>
        )}
        {currentView === 'lab' && (
          <motion.div key="lab" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} transition={{ duration: 0.8 }}>
            <Lab />
          </motion.div>
        )}
      </AnimatePresence>

      <Dock />
    </main>
  );
}
