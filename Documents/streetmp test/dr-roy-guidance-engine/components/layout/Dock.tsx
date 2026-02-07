"use client";

import { motion } from "framer-motion";
import { Home, Grid, FileText, User, Lightbulb, FlaskConical } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import clsx from "clsx";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Reuse PDF logic or import it (Ideally we'd refactor ReportButton to be a hook, but for now we'll duplicate or inline for speed/stability)
// Let's import the component but we need to trigger it. 
// Actually, let's just use the ReportButton logic here for the 'action'.

// PDF Styles (Duplicated for availability in Dock)
const styles = StyleSheet.create({
    page: { padding: 40, backgroundColor: "#ffffff" },
    header: { fontSize: 24, marginBottom: 20, textAlign: 'center', color: '#1e3a8a' },
    section: { margin: 10, padding: 10 },
    text: { fontSize: 12, marginBottom: 5 },
    label: { fontSize: 10, color: '#64748b', marginBottom: 2, textTransform: 'uppercase' },
    value: { fontSize: 12, marginBottom: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, textAlign: 'center', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 10 },
    title: { fontSize: 24, textAlign: 'center', marginBottom: 10, fontFamily: 'Helvetica-Bold' },
    subtitle: { fontSize: 12, textAlign: 'center', marginBottom: 30, color: '#64748b' },
});

// Export PDFDocument for ReportPreview.tsx
export const PDFDocument = ({ data }: { data: any }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>Dr. Roy Prasad Guidance Engine</Text>
                <Text style={styles.subtitle}>Strategic Workforce & Career Intelligence Report</Text>
                <Text style={styles.text}>Generated: {new Date().toLocaleDateString()}</Text>
            </View>
            <View style={styles.section}>
                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, marginBottom: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 5 }}>Executive Summary</Text>
                    <Text style={styles.text}>Based on the simulated parameters, the following strategy assessment has been generated.</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                    <View style={{ width: '50%', paddingRight: 10 }}>
                        <Text style={styles.label}>Migration Readiness</Text>
                        <Text style={styles.value}>IELTS: {data.migration.ieltsScore} | Level: {data.migration.educationLevel}</Text>
                        <Text style={styles.label}>Data Center Salary Proj.</Text>
                        <Text style={styles.value}>Skill Lvl: {data.salary.currentSkillLevel} | Cert Lvl: {data.salary.certificationLevel}</Text>
                    </View>
                    <View style={{ width: '50%' }}>
                        <Text style={styles.label}>Workforce ROI Potential</Text>
                        <Text style={styles.value}>Staff: {data.roi.staffCount} | Turnover: {data.roi.turnoverRate}%</Text>
                        <Text style={styles.label}>Innovation Score</Text>
                        <Text style={styles.value}>Viability: {data.innovation.marketSize * data.innovation.feasibility}/100</Text>
                    </View>
                </View>

                <View style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                    <Text style={styles.label}>Future Design (Career Map)</Text>
                    <Text style={styles.value}>{data.futureDesign?.role} in {data.futureDesign?.country}</Text>
                    <Text style={styles.text}>(Path Analysis Included in Full Report)</Text>
                </View>

            </View>
            <Text style={styles.footer}>Verified Ecosystem: EDUK8U | Workready Asia | ICQA | Attend Care</Text>
        </Page>
    </Document>
);

export default function Dock() {
    const { currentView, setCurrentView } = useUIStore();
    // Hooks for future use if needed
    // const store = useSimulationStore();
    // const [isGenerating, setIsGenerating] = useState(false);

    const items = [
        { id: 'hero', icon: Home, label: 'Home', action: () => setCurrentView('hero') },
        { id: 'grid', icon: Grid, label: 'Tools', action: () => setCurrentView('grid') },
        { id: 'insights', icon: Lightbulb, label: 'Insights', action: () => setCurrentView('insights') },
        { id: 'contact', icon: User, label: 'Contact', action: () => setCurrentView('contact') },
        { id: 'report', icon: FileText, label: 'Report', action: () => setCurrentView('report-preview') }, // Changed action
        { id: 'lab', icon: FlaskConical, label: 'Dr Roy Lab', action: () => setCurrentView('lab') }, // Added Lab
    ];

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <motion.div
                layout
                className="glass-panel px-6 py-4 rounded-full border border-white/10 shadow-2xl backdrop-blur-xl flex items-center gap-2"
            >
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={item.action}
                        className={clsx(
                            "relative group p-3 rounded-full transition-all duration-300",
                            currentView === item.id
                                ? "bg-white/10 text-white shadow-lg shadow-white/5"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <item.icon size={24} className="relative z-10" />

                        {/* Tooltip */}
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/80 backdrop-blur-md rounded-lg text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {item.label}
                        </div>

                        {/* Active Indicator */}
                        {currentView === item.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-white/10 rounded-full"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>
                ))}
            </motion.div>
        </div>
    );
}
