/**
 * @file workflowService.ts
 * @version V24
 * @description V24 Verified Workflow Marketplace Backend
 *
 * Hosts immutable, pre-approved Enterprise AI Applications.
 * Each workflow contains a strict system prompt and mandatory data classification,
 * preventing users from "wild prompting" outside of legal safety rails.
 */
const VERIFIED_WORKFLOWS = [
    {
        id: "wf_ma_risk_analyzer",
        name: "M&A Risk Analyzer",
        description: "Evaluates merger & acquisition term sheets for regulatory and liability risks.",
        category: "Legal",
        icon: "💼",
        system_prompt: `You are a Principal M&A Attorney. Analyze the provided contract text.
Extract major liabilities, regulatory risks, and unfavorable terms.
Provide the output as a strict JSON array of risk objects.`,
        input_variables: ["Contract Text"],
        required_classification: "CONFIDENTIAL",
        supported_tenants: "ALL",
        required_compliance: "SEC_FINANCE",
    },
    {
        id: "wf_gdpr_redactor",
        name: "PII & GDPR Redactor",
        description: "Identifies and redacts Personally Identifiable Information from raw text.",
        category: "Compliance",
        icon: "🛡️",
        system_prompt: `You are a European Data Privacy Officer. Review the following text.
Replace all names, emails, phone numbers, and identifying details with [REDACTED].
Output ONLY the sanitized text.`,
        input_variables: ["Raw Document"],
        required_classification: "CONFIDENTIAL",
        supported_tenants: "ALL",
        required_compliance: "GDPR_EU",
    },
    {
        id: "wf_jpmc_algo_review",
        name: "Proprietary Trading Algorithmic Review",
        description: "JPMC Internal: Reviews algorithmic trading logic against Dodd-Frank constraints.",
        category: "Engineering",
        icon: "📈",
        system_prompt: `You are a Quantitative Risk Engineer at JPMC.
Analyze the provided algorithm constraints against Title VII of Dodd-Frank.
Return a JSON compliance report.`,
        input_variables: ["Algorithm Constraints"],
        required_classification: "TOP_SECRET",
        supported_tenants: ["FINANCE"], // Only the JPMC/FINANCE tenant can see this
        required_compliance: "SEC_FINANCE",
    },
    {
        id: "wf_resume_screener",
        name: "Unbiased Resume Screener",
        description: "Screens applicant resumes removing name, gender, and school bias.",
        category: "HR",
        icon: "📑",
        system_prompt: `You are an HR Screener. You must evaluate this resume entirely without bias.
Focus only on skills, experience, and certifications.
Provide a boolean "match" and a short "reasoning". Output JSON.`,
        input_variables: ["Resume Text", "Job Requirements"],
        required_classification: "PUBLIC",
        supported_tenants: "ALL",
    },
];
/**
 * Returns the list of workflows an organization is authorized to use.
 */
export function getWorkflowsForTenant(tenantId) {
    return VERIFIED_WORKFLOWS.filter((wf) => {
        return wf.supported_tenants === "ALL" || wf.supported_tenants.includes(tenantId);
    });
}
