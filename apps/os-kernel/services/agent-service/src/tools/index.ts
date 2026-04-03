export interface Tool {
  name: string;
  description: string;
  requiredRole: string[]; // E.g., ["USER", "ADMIN", "OWNER"] indicating who can use it
  execute(input: string, tenantId: string): Promise<string>;
}
