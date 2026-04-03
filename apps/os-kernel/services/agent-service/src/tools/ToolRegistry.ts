import { Tool } from "./index";
import { WebSearchTool } from "./WebSearchTool";
import { VaultQueryTool } from "./VaultQueryTool";

export class ToolRegistry {
  private allTools: Tool[];

  constructor() {
    this.allTools = [
      new WebSearchTool(),
      new VaultQueryTool(),
    ];
  }

  /**
   * Evaluates the active user's V65 RBAC permission and returns
   * the exact list of tools they are securely authorized to invoke.
   */
  public getAuthorizedTools(userRole: string): Tool[] {
    return this.allTools.filter((tool) => tool.requiredRole.includes(userRole));
  }

  public getToolByName(name: string): Tool | undefined {
    return this.allTools.find(t => t.name === name);
  }
}
