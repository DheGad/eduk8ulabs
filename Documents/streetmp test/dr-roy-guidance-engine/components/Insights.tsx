"use client";
import { motion } from "framer-motion";
import { Briefcase, GraduationCap, BookOpen, Globe, CheckCircle, Trophy, Star, TrendingUp } from "lucide-react";

export default function Insights() {
    const experience = [
        { role: "Chief Human Resources Officer", company: "Workready Asia", duration: "Mar 2022 - Present", location: "Brisbane, Australia", desc: "Leading Australian Allied Health workforce partner dedicated to bridging the critical skills gap in Regional Australia." },
        { role: "Group Managing Director", company: "EDUK8U®", duration: "Feb 2018 - Present", location: "Brisbane, Australia", desc: "Fostering initiative, exploration, critical thought, and innovation to guide individuals to become who they aspire to be." },
        { role: "Chief Executive Officer", company: "ICQA", duration: "Sep 2023 - Present", location: "Brisbane City, Australia", desc: "Leading strategic growth and expansion of CRICOS-registered ELICOS provider." },
        { role: "Board of Advisors", company: "IBAS Switzerland", duration: "Mar 2024 - Present", location: "Zurich, Switzerland", desc: "Executive Advisory and Board Advisory Services." },
        { role: "Professor (Honorary)", company: "IUKL", duration: "Jun 2022 - Present", location: "Kuala Lumpur, Malaysia", desc: "Faculty of Business, Information and Human Sciences." },
        { role: "Head Of Human Resources", company: "Ibiden Malaysia", duration: "May 2018 - Dec 2022", location: "Penang, Malaysia", desc: "Led a 24-month transformation of a low performing EMS manufacturing business, optimizing 2,723 head-count." },
        { role: "Chief Executive Officer", company: "IHR Consulting", duration: "Jan 2014 - Jan 2019", location: "Kuala Lumpur", desc: "Led management team to solve critical problems and achieved cost savings exceeding RM 13 Million." },
        { role: "General Manager Asia PAC", company: "Praxis BT", duration: "Feb 2012 - Jan 2014", location: "Kuala Lumpur", desc: "Grew and positioned Praxis as the leading Google Geospatial Enterprise Partner in Asia." },
        { role: "Chief Executive Officer", company: "Employment Systems", duration: "Sep 2009 - Feb 2012", location: "Sydney", desc: "Reinvented recruitment and HR landscape as game changing cloud solution including Skills Connect." },
        { role: "Business Lead & Founder", company: "First Chartered Capital", duration: "Jul 2003 - Sep 2009", location: "Chatswood", desc: "Established as a finance consulting and advisory business, specialising in commercial development." },
        { role: "Chief Financial Officer", company: "Lynx Financial Systems", duration: "Sep 2000 - Apr 2003", location: "Sydney", desc: "Managed and improved internal business processes for project delivery and resource allocation." },
        { role: "Group Accountant", company: "Val Morgan Cinema", duration: "Jan 1999 - 2000", location: "Sydney", desc: "Australia and New Zealand’s leading national supplier of screen advertising." },
        { role: "Finance Office Manager", company: "Ramsay Health Care", duration: "Jan 1997 - Jan 1999", location: "Sydney", desc: "Played an integral role in promoting the company to listing on the Australian Stock Exchange." },
        { role: "Financial Accountant", company: "Kuwait Embassy", duration: "Jun 1994 - 1996", location: "Canberra", desc: "Financial accounting and management." },
    ];

    const education = [
        { degree: "Doctor of Business Administration", school: "IBAS Switzerland", year: "2015-2018", desc: "Specialisation in People Incentive & Bonus Modelling." },
        { degree: "Executive Masters, HR Mgmt", school: "KLUST", year: "2021", desc: "Human Resources Management." },
        { degree: "Post Graduate, Innovation", school: "Univ of Newcastle", year: "2013-2015", desc: "Innovation and Commercialisation." },
        { degree: "Grad Mgt Qlf, Business", school: "Bond University", year: "1997-2000", desc: "Graduate Management (Int Business)." },
        { degree: "Diploma FS, Financial Services", school: "Deakin University", year: "2007-2008", desc: "Dip Fin Services." },
        { degree: "Diploma in Real Estate", school: "TAFE NSW", year: "", desc: "Real Estate." },
    ];

    const awards = [
        { title: "Silver Winner - Vendor of the Year", org: "Human Resources Online", date: "Nov 2017", desc: "Best Payroll Outsourcing Partner (IHR Consulting)." },
        { title: "Disruptive Industry Innovation", org: "Entrepreneurship Foundation", date: "Oct 2017", desc: "Award for HR Insurance and Payroll Outsourcing." },
        { title: "Bronze Winner - Vendor of the Year", org: "Human Resources Online", date: "Nov 2015", desc: "Best Payroll Outsourcing Partner." },
        { title: "Australian Technology Showcase", org: "Dept of Trade & Investment", date: "Jul 2011", desc: "Official Member (Employment Management Systems)." },
    ];

    return (
        <div className="min-h-screen pt-24 pb-32 px-4 md:px-12 relative overflow-y-auto font-sans">

            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-6xl mx-auto mb-16 text-center"
            >
                <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-white to-purple-300 mb-6 tracking-tight drop-shadow-lg">
                    Meet the New Millionaire Visionary Leader
                </h1>
                <p className="text-xl md:text-2xl text-blue-100 font-light max-w-3xl mx-auto leading-relaxed">
                    “Architecting the future of Human Capital through Innovation & Education.”
                </p>

                <div className="flex justify-center flex-wrap gap-4 mt-8">
                    <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
                        <TrendingUp size={16} className="text-green-400" />
                        <span className="text-sm font-semibold">Business Growth</span>
                    </div>
                    <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
                        <Globe size={16} className="text-blue-400" />
                        <span className="text-sm font-semibold">Global Talent</span>
                    </div>
                    <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
                        <BookOpen size={16} className="text-purple-400" />
                        <span className="text-sm font-semibold">Education Reform</span>
                    </div>
                </div>
            </motion.div>

            {/* Main Content Grid */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Experience (Timeline) */}
                <div className="lg:col-span-7 space-y-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="flex items-center gap-3 mb-6"
                    >
                        <Briefcase className="text-blue-400" size={28} />
                        <h2 className="text-3xl font-bold text-white">Professional Odyssey</h2>
                    </motion.div>

                    <div className="relative border-l-2 border-white/10 ml-3 space-y-10 pl-8 pb-4">
                        {experience.map((job, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.05 }}
                                className="relative"
                            >
                                {/* Timeline Dot */}
                                <div className="absolute -left-[41px] top-1 w-5 h-5 rounded-full bg-blue-900 border-2 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />

                                <div className="glass-card p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all duration-300 group">
                                    <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-2">
                                        <div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">{job.role}</h3>
                                            <p className="text-blue-200 font-medium">{job.company}</p>
                                        </div>
                                        <span className="text-xs font-mono text-gray-400 bg-black/30 px-2 py-1 rounded mt-2 md:mt-0 w-fit">{job.duration}</span>
                                    </div>
                                    <p className="text-sm text-gray-400 mb-2">{job.location}</p>
                                    <p className="text-sm text-gray-300 leading-relaxed border-t border-white/5 pt-3 mt-3">
                                        {job.desc}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Education, Awards, Certs */}
                <div className="lg:col-span-5 space-y-8">

                    {/* Education */}
                    <div className="glass-card p-6 rounded-3xl border border-white/10 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <GraduationCap className="text-purple-400" size={24} />
                            <h2 className="text-2xl font-bold text-white">Academic Excellence</h2>
                        </div>
                        <div className="space-y-4 relative z-10">
                            {education.map((edu, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-white text-sm">{edu.degree}</h4>
                                        <span className="text-[10px] bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded ml-2 whitespace-nowrap">{edu.year}</span>
                                    </div>
                                    <p className="text-xs text-purple-200 mt-1">{edu.school}</p>
                                    <p className="text-xs text-gray-400 mt-1">{edu.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                        {/* Decorative Blur */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[60px]" />
                    </div>

                    {/* Awards */}
                    <div className="glass-card p-6 rounded-3xl border border-white/10 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <Trophy className="text-yellow-400" size={24} />
                            <h2 className="text-2xl font-bold text-white">Honors & Awards</h2>
                        </div>
                        <div className="space-y-4 relative z-10">
                            {awards.map((award, i) => (
                                <div key={i} className="flex gap-3 items-start p-3 rounded-lg hover:bg-white/5 transition-colors">
                                    <div className="mt-1">
                                        <Star size={16} className="text-yellow-500 fill-yellow-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-100 text-sm">{award.title}</h4>
                                        <p className="text-xs text-yellow-200/80">{award.org} • {award.date}</p>
                                        <p className="text-xs text-gray-500 mt-1">{award.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Certifications (Visual Only) */}
                    <div className="glass-card p-6 rounded-3xl border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <CheckCircle className="text-green-400" size={24} />
                            <h2 className="text-2xl font-bold text-white">Credentials</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {['ISO 9001:2015', 'Labour Hire Lic', 'TAE40122', 'HRD Corp Trainer', 'RCSA Member', 'MABC Member', 'SBAA Member'].map((cert, i) => (
                                <span key={i} className="px-3 py-1 bg-green-900/20 text-green-300 border border-green-500/20 rounded-full text-xs font-medium">
                                    {cert}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Publications */}
                    <div className="glass-card p-6 rounded-3xl border border-white/10 bg-gradient-to-br from-blue-900/20 to-black/40">
                        <div className="flex items-center gap-3 mb-4">
                            <BookOpen className="text-cyan-400" size={24} />
                            <h2 className="text-xl font-bold text-white">Publications</h2>
                        </div>
                        <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                            <h4 className="font-bold text-white mb-1">Cloud computing technology lowers hire costs</h4>
                            <p className="text-xs text-cyan-200 mb-2">The Australian - Derek Parker • Jun 18, 2011</p>
                            <p className="text-xs text-gray-400 italic">&quot;Cloud computing technology is emerging as a key tool in recruitment processes...&quot;</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
