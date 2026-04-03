"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, Loader2 } from "lucide-react";

export function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "bot" | "user"; text: string }[]>([
    { role: "bot", text: "Hi! I'm the StreetMP OS Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [userDetails, setUserDetails] = useState({ name: "", email: "" });
  const [isCollectingDetails, setIsCollectingDetails] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Common FAQ bot replies
  const botReplies = [
    "StreetMP OS provides zero-trust cryptography for your enterprise AI layer.",
    "We use advanced Tokenization to ensure your PII never reaches public models.",
    "Yes, our proxy is fully SOC2, HIPAA, and GDPR compliant ready.",
    "Our setup takes about 15 minutes to deploy on your own premises.",
    "The STP Protocol ensures mathematically irreversible protection of data.",
    "Would you like to speak to an enterprise architect?",
    "You can test our free AI audit tools from our top navigation.",
    "Pricing is $49/mo for professionals and custom for large enterprises.",
    "Let me get a human to help answer these specific questions."
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);

    if (messages.length >= 3 && !userDetails.email && !isCollectingDetails) {
      setIsCollectingDetails(true);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { role: "bot", text: "Before we continue, could I get your name and work email so an expert can follow up?" }]);
      }, 1000);
      return;
    }

    if (isCollectingDetails) {
      // Very basic handling of contact details
      if (!userDetails.name) {
        setUserDetails(prev => ({ ...prev, name: userMsg }));
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, { role: "bot", text: "Thanks! And your work email?" }]);
        }, 800);
        return;
      } else if (!userDetails.email) {
        setUserDetails(prev => ({ ...prev, email: userMsg }));
        setIsCollectingDetails(false);
        setIsTyping(true);
        // Mock API Call to /api/contact
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, { role: "bot", text: "Perfect. We've notified our Enterprise team. We will get back to you shortly!" }]);
          console.log("Mock submission to admin dashboard ->", { name: userDetails.name, email: userMsg });
        }, 1200);
        return;
      }
    }

    // Default random reply for demo purposes
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const randomReply = botReplies[Math.floor(Math.random() * botReplies.length)]!;
      setMessages(prev => [...prev, { role: "bot", text: randomReply }]);
    }, 1500);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 hover:bg-emerald-400 transition-all duration-300 ${isOpen ? "opacity-0 scale-90 pointer-events-none" : "opacity-100"}`}
        aria-label="Open Chat"
      >
        <MessageSquare className="w-6 h-6 fill-current" />
      </button>

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[90vw] max-w-[360px] h-[550px] max-h-[80vh] bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/[0.04] border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Security Architect</h3>
                <p className="text-[10px] text-emerald-400 font-medium tracking-wide uppercase">Online</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === "bot" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white"}`}>
                  {msg.role === "bot" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                </div>
                <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm leading-relaxed ${
                  msg.role === "bot" 
                    ? "bg-white/[0.04] border border-white/5 text-zinc-200 rounded-tl-sm" 
                    : "bg-emerald-500 text-black font-medium rounded-tr-sm"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-3 h-3" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/5 rounded-tl-sm flex items-center gap-1.5 h-10 w-16 justify-center">
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="shrink-0 p-3 bg-white/[0.02] border-t border-white/10">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder="Ask about StreetMP OS..."
                className="w-full bg-black/50 border border-white/10 rounded-full py-3 px-4 pr-12 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="absolute right-1.5 p-2 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:scale-95"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
            <div className="text-center mt-2">
               <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Encrypted Connection</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
