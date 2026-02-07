export const projectId = 'your-project-id';
export const dataset = 'production';
export const apiVersion = '2023-05-03';

// Stub client - requires `next-sanity` or `sanity` client usually, 
// strictly following prompt to create a "file stub".
export const client = {
    fetch: async (query: string) => {
        // Return mock data for now
        return [
            { _id: '1', title: 'The Future of Workforce AI', slug: { current: 'workforce-ai' } },
            { _id: '2', title: 'Migration Policy Update 2026', slug: { current: 'migration-update' } },
            { _id: '3', title: 'Skills Shortage in Cybersecurity', slug: { current: 'skills-shortage' } },
        ];
    }
};

export const insightsQuery = `*[_type == "insight"] { _id, title, slug }`;
