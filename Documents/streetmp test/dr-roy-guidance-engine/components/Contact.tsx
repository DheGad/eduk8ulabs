"use client";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";

export default function Contact() {
    return (
        <section className="container mx-auto px-4 py-20 min-h-screen text-white flex items-center justify-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12"
            >
                {/* Contact Info */}
                <div className="space-y-8">
                    <div>
                        <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-white">
                            Get in Touch
                        </h2>
                        <p className="text-gray-400 text-lg">
                            Connect with Dr. Roy Prasad for strategic consulting, speaking engagements, or partnership opportunities.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4 p-4 glass-card rounded-xl border border-white/5">
                            <Mail className="text-blue-400 mt-1" />
                            <div>
                                <h4 className="font-bold text-white">Email</h4>
                                <a href="mailto:info@icqa.qld.edu.au" className="text-gray-400 hover:text-blue-300 transition-colors">info@icqa.qld.edu.au</a>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 glass-card rounded-xl border border-white/5">
                            <Phone className="text-green-400 mt-1" />
                            <div>
                                <h4 className="font-bold text-white">Phone</h4>
                                <div className="text-gray-400">+61 420457883 (Australia)</div>
                                <div className="text-gray-400">+60 129880370 (Malaysia)</div>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 glass-card rounded-xl border border-white/5">
                            <MapPin className="text-purple-400 mt-1" />
                            <div>
                                <h4 className="font-bold text-white">Headquarters</h4>
                                <p className="text-gray-400">
                                    2/5-11 Noel Street,<br />
                                    Slacks Creek. Queensland 4127.<br />
                                    Australia.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Form */}
                <div className="glass-card p-8 rounded-3xl border border-white/10">
                    <form className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                            <input
                                type="text"
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="Your Name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                            <input
                                type="email"
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="name@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Message</label>
                            <textarea
                                rows={4}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="How can we collaborate?"
                            />
                        </div>

                        <button className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl font-bold text-white hover:from-blue-500 hover:to-blue-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
                            Send Message
                            <Send size={18} />
                        </button>
                    </form>
                </div>

            </motion.div>
        </section>
    );
}
