import { app } from "electron";
import Store from "electron-store";
import { join } from "path";
import type {
  AgentDefinition,
  AgentListItem,
  BuiltinToolName,
} from "@shared/types";

interface AgentDefinitionStoreData {
  agents: Record<string, AgentDefinition>;
  version: number;
}

const ALL_TOOLS: BuiltinToolName[] = [
  "read",
  "write",
  "edit",
  "bash",
  "grep",
  "find",
  "ls",
];

const PRESET_AGENTS: AgentDefinition[] = [
  {
    id: "default",
    name: "开发 Agent",
    description: "分析项目、修改文件并完成验证。",
    systemPrompt:
      "你是负责开发任务的 Agent。先理解项目和目标，再用工具完成实现与验证。说明关键变更、验证结果和未解决风险。",
    tools: ALL_TOOLS,
    skills: [],
    icon: "bot",
    color: "#2563eb",
    isDefault: true,
  },
  {
    id: "code-reviewer",
    name: "代码审查 Agent",
    description: "以只读方式发现缺陷、回归风险与测试缺口。",
    systemPrompt:
      "你是严谨的代码审查 Agent。优先使用只读工具理解变更与上下文，按严重程度给出可定位、可验证的发现。不要修改项目文件。",
    tools: ["read", "grep", "find", "ls"],
    skills: ["code-review"],
    icon: "shield-check",
    color: "#0f766e",
    isDefault: false,
  },
  {
    id: "test-generator",
    name: "测试 Agent",
    description: "补齐测试、运行验证并解释失败原因。",
    systemPrompt:
      "你是测试 Agent。先理解现有测试约定，再补齐有价值的测试，运行相关验证并如实汇报结果。",
    tools: ["read", "write", "edit", "bash", "grep", "find", "ls"],
    skills: ["testing"],
    icon: "flask-conical",
    color: "#9333ea",
    isDefault: false,
  },
  {
    id: "documentation-writer",
    name: "文档 Agent",
    description: "维护清晰、可执行且与代码一致的文档。",
    systemPrompt:
      "你是文档 Agent。依据项目事实维护简洁、准确、面向贡献者的文档；明确验证方式与尚未完成的边界。",
    tools: ["read", "write", "edit", "grep", "find", "ls"],
    skills: ["documentation"],
    icon: "file-text",
    color: "#b45309",
    isDefault: false,
  },
];

export class AgentDefinitionManager {
  private readonly store: Store<AgentDefinitionStoreData>;

  constructor() {
    this.store = new Store<AgentDefinitionStoreData>({
      cwd: join(app.getPath("home"), ".agentbuddy", "agents"),
      name: "agent-definitions",
      defaults: { agents: {}, version: 1 },
    });
    this.ensurePresets();
  }

  list(): AgentListItem[] {
    return Object.values(this.store.get("agents"))
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault))
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        tools: [...agent.tools],
        skills: [...agent.skills],
        icon: agent.icon,
        color: agent.color,
        isDefault: agent.isDefault,
      }));
  }

  get(agentId: string): AgentDefinition {
    const agent = this.store.get("agents")[agentId];
    if (!agent) throw new Error("AGENT_NOT_FOUND");
    return clone(agent);
  }

  has(agentId: string): boolean {
    return Boolean(this.store.get("agents")[agentId]);
  }

  private ensurePresets(): void {
    const agents = this.store.get("agents");
    const missing = PRESET_AGENTS.filter((agent) => !agents[agent.id]);
    if (missing.length === 0) return;
    this.store.set("agents", {
      ...agents,
      ...Object.fromEntries(missing.map((agent) => [agent.id, agent])),
    });
  }
}

let manager: AgentDefinitionManager | undefined;

export function getAgentDefinitionManager(): AgentDefinitionManager {
  manager ??= new AgentDefinitionManager();
  return manager;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
