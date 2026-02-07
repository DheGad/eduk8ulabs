"use client";

import { useSimulationStore } from "@/store/simulationStore";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { useState } from "react";

// PDF Styles
const styles = StyleSheet.create({
    page: { padding: 40, backgroundColor: "#ffffff" },
    header: { fontSize: 24, marginBottom: 20, textAlign: 'center', color: '#1e3a8a' },
    section: { margin: 10, padding: 10 },
    text: { fontSize: 12, marginBottom: 5 },
    label: { fontSize: 10, color: '#64748b' },
    value: { fontSize: 14, marginBottom: 10 },
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, textAlign: 'center', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 10 },
    riskHigh: { color: '#ef4444' },
    riskLow: { color: '#22c55e' },
});

// PDF Document Component
const ReportDocument = ({ data }: { data: any }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.section}>
                <Text style={styles.header}>Guidance by Dr. Roy Prasad</Text>
                <Text style={{ fontSize: 10, textAlign: 'center', marginBottom: 30, color: '#64748b' }}>
                    Strategic Workforce & Migration Assessment
                </Text>

                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, marginBottom: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 5 }}>Executive Summary</Text>
                    <Text style={styles.text}>
                        Based on the simulated parameters, the following strategy assessment has been generated.
                    </Text>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {/* Radar Data */}
                    <View style={{ width: '50%', paddingRight: 10 }}>
                        <Text style={styles.label}>English Proficiency</Text>
                        <Text style={styles.value}>{data.radar.english}/100</Text>

                        <Text style={styles.label}>Technical Skill</Text>
                        <Text style={styles.value}>{data.radar.techSkill}/100</Text>
                    </View>
                    <View style={{ width: '50%' }}>
                        <Text style={styles.label}>Experience Level</Text>
                        <Text style={styles.value}>{data.radar.experience}/100</Text>

                        <Text style={styles.label}>Visa Risk</Text>
                        <Text style={styles.value}>
                            {data.migration.visaSubclass === '482' ? 'Medium (Subclass 482)' :
                                data.migration.visaSubclass === '186' ? 'Low (Subclass 186)' : 'High (Subclass 500)'}
                        </Text>
                    </View>
                </View>

                <View style={{ marginTop: 20 }}>
                    <Text style={styles.label}>Career Trajectory</Text>
                    <Text style={styles.value}>
                        Candidate has {data.career.yearsExperience} years of experience
                        {data.career.hasDegree ? " with a University Degree" : " without a degree"}.
                    </Text>
                </View>

            </View>

            <Text style={styles.footer}>
                Verified Ecosystem: EDUK8U | Workready Asia | ICQA
            </Text>
        </Page>
    </Document>
);

export default function ReportButton() {
    const store = useSimulationStore();
    const [loading, setLoading] = useState(false);

    const handleDownload = async () => {
        setLoading(true);
        try {
            // Generate PDF blob
            const blob = await pdf(<ReportDocument data={store} />).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `DrRoy_Strategy_Report_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("PDF generation failed", error);
        }
        setLoading(false);
    };

    return (
        <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg text-sm border border-blue-500/30 transition-all"
        >
            <Download size={16} />
            {loading ? "Generating..." : "Download Strategy Report"}
        </button>
    );
}
