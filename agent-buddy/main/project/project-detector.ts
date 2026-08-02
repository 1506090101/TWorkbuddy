import { app } from "electron";
import Store from "electron-store";
import { readFile, readdir, realpath, stat } from "fs/promises";
import { join } from "path";
import type {
  DependencyInfo,
  ProjectContext,
  ProjectStructure,
  ProjectType,
} from "@shared/types";

interface ProjectContextCache {
  signature: string;
  context: ProjectContext;
}

interface ProjectContextStoreData {
  contexts: Record<string, ProjectContextCache>;
  version: number;
}

const IDENTIFIERS: Array<{ file: string; type: ProjectType }> = [
  { file: "package.json", type: "node" },
  { file: "Cargo.toml", type: "rust" },
  { file: "go.mod", type: "go" },
  { file: "pom.xml", type: "java" },
  { file: "build.gradle", type: "java" },
  { file: "requirements.txt", type: "python" },
  { file: "pyproject.toml", type: "python" },
  { file: "CMakeLists.txt", type: "cpp" },
  { file: "Makefile", type: "cpp" },
];

const CACHE_FILES = [
  ...IDENTIFIERS.map((item) => item.file),
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "tsconfig.json",
];

const SOURCE_DIRECTORIES = [
  "src",
  "app",
  "lib",
  "packages",
  "main",
  "renderer",
  "server",
  "client",
];
const TEST_DIRECTORIES = ["test", "tests", "__tests__", "spec", "specs"];
const ENTRY_POINTS = [
  "src/main.ts",
  "src/main.tsx",
  "src/index.ts",
  "src/index.tsx",
  "src/index.js",
  "src/App.tsx",
  "app/page.tsx",
  "main.py",
  "main.go",
  "src/main.rs",
  "Main.java",
];
const CONFIG_FILES = [
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "webpack.config.js",
  "next.config.js",
  "next.config.mjs",
  "tailwind.config.js",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "requirements.txt",
  "pom.xml",
  "CMakeLists.txt",
];
const FRAMEWORKS = [
  "next",
  "nuxt",
  "react",
  "vue",
  "svelte",
  "express",
  "fastify",
  "koa",
  "nestjs",
  "django",
  "flask",
  "fastapi",
];

export class ProjectDetector {
  private readonly store: Store<ProjectContextStoreData>;

  constructor() {
    this.store = new Store<ProjectContextStoreData>({
      cwd: join(app.getPath("home"), ".agentbuddy", "projects"),
      name: "project-contexts",
      defaults: { contexts: {}, version: 1 },
    });
  }

  async detect(rootPath: string, refresh = false): Promise<ProjectContext> {
    const root = await getProjectRoot(rootPath);
    const signature = await this.getSignature(root);
    const cached = this.store.get("contexts")[root];
    if (!refresh && cached?.signature === signature)
      return clone(cached.context);

    const context = await this.detectFresh(root);
    const contexts = this.store.get("contexts");
    this.store.set("contexts", {
      ...contexts,
      [root]: { signature, context },
    });
    return clone(context);
  }

  async getCached(rootPath: string): Promise<ProjectContext | null> {
    const root = await getProjectRoot(rootPath);
    const cached = this.store.get("contexts")[root];
    if (!cached) return null;
    const signature = await this.getSignature(root);
    return cached.signature === signature ? clone(cached.context) : null;
  }

  private async detectFresh(root: string): Promise<ProjectContext> {
    const entries = await readdir(root, { withFileTypes: true });
    const names = new Set(entries.map((entry) => entry.name));
    const detected = IDENTIFIERS.filter((item) => names.has(item.file)).map(
      (item) => item.type
    );
    const types = [...new Set(detected)];
    const type: ProjectType =
      types.length === 0 ? "unknown" : types.length === 1 ? types[0] : "mixed";
    const packageJson = names.has("package.json")
      ? await readPackageJson(join(root, "package.json"))
      : undefined;
    const dependencies = collectDependencies(packageJson);
    const scripts = sanitizeScripts(packageJson?.scripts);
    const framework = detectFramework(dependencies);
    const structure = await detectStructure(root, names);
    const packageManager = detectPackageManager(type, names);

    return {
      rootPath: root,
      type,
      language: detectLanguage(type, names, dependencies),
      framework,
      packageManager,
      buildSystem: detectBuildSystem(names, packageJson, dependencies),
      testCommand: toScriptCommand(packageManager, "test", scripts.test),
      lintCommand: toScriptCommand(packageManager, "lint", scripts.lint),
      buildCommand: toScriptCommand(packageManager, "build", scripts.build),
      startCommand: scripts.start
        ? toScriptCommand(packageManager, "start", scripts.start)
        : toScriptCommand(packageManager, "dev", scripts.dev),
      dependencies: dependencies.slice(0, 120),
      scripts: Object.keys(scripts).length > 0 ? scripts : undefined,
      structure,
      detectedAt: Date.now(),
    };
  }

  private async getSignature(root: string): Promise<string> {
    const parts = await Promise.all(
      CACHE_FILES.map(async (file) => {
        try {
          const info = await stat(join(root, file));
          return `${file}:${info.size}:${info.mtimeMs}`;
        } catch {
          return `${file}:missing`;
        }
      })
    );
    return parts.join("|");
  }
}

async function getProjectRoot(rootPath: string): Promise<string> {
  if (!rootPath.trim()) throw new Error("PROJECT_ROOT_REQUIRED");
  const root = await realpath(rootPath);
  const details = await stat(root);
  if (!details.isDirectory()) throw new Error("PROJECT_ROOT_NOT_DIRECTORY");
  return root;
}

async function readPackageJson(path: string): Promise<PackageJson | undefined> {
  try {
    const info = await stat(path);
    if (info.size > 2 * 1024 * 1024) return undefined;
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    return isPackageJson(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function detectStructure(
  root: string,
  names: Set<string>
): Promise<ProjectStructure> {
  const sourceDirs = SOURCE_DIRECTORIES.filter((directory) =>
    names.has(directory)
  );
  const testDirs = TEST_DIRECTORIES.filter((directory) => names.has(directory));
  const configFiles = CONFIG_FILES.filter((file) => names.has(file));
  const entryPoints: string[] = [];
  for (const entry of ENTRY_POINTS) {
    try {
      const details = await stat(join(root, entry));
      if (details.isFile()) entryPoints.push(entry);
    } catch {
      // An absent conventional entry point is expected.
    }
  }
  return { sourceDirs, testDirs, configFiles, entryPoints };
}

function collectDependencies(pkg?: PackageJson): DependencyInfo[] {
  const entries = [
    ...Object.entries(pkg?.dependencies ?? {}).map(([name, version]) => ({
      name,
      version,
      isDev: false,
    })),
    ...Object.entries(pkg?.devDependencies ?? {}).map(([name, version]) => ({
      name,
      version,
      isDev: true,
    })),
  ];
  return entries.map((item) => ({
    ...item,
    version: String(item.version).replace(/^[~^]/, "").slice(0, 80),
  }));
}

function detectFramework(dependencies: DependencyInfo[]): string | undefined {
  const byName = new Map(dependencies.map((item) => [item.name, item.version]));
  const name = FRAMEWORKS.find((candidate) => byName.has(candidate));
  return name
    ? `${name}${byName.get(name) ? ` ${byName.get(name)}` : ""}`
    : undefined;
}

function detectLanguage(
  type: ProjectType,
  names: Set<string>,
  dependencies: DependencyInfo[]
): string {
  if (type === "mixed") return "多语言";
  if (type === "node") {
    return names.has("tsconfig.json") ||
      dependencies.some((item) => item.name === "typescript")
      ? "TypeScript"
      : "JavaScript";
  }
  return (
    {
      python: "Python",
      rust: "Rust",
      go: "Go",
      java: "Java",
      cpp: "C++",
      unknown: "未知",
    }[type] ?? "未知"
  );
}

function detectPackageManager(
  type: ProjectType,
  names: Set<string>
): string | undefined {
  if (names.has("pnpm-lock.yaml")) return "pnpm";
  if (names.has("yarn.lock")) return "yarn";
  if (names.has("package-lock.json")) return "npm";
  if (type === "node") return "npm";
  if (type === "python") return "pip";
  if (type === "rust") return "cargo";
  if (type === "go") return "go";
  if (type === "java") return "maven";
  return undefined;
}

function detectBuildSystem(
  names: Set<string>,
  pkg: PackageJson | undefined,
  dependencies: DependencyInfo[]
): string | undefined {
  const dependencyNames = new Set(dependencies.map((item) => item.name));
  if (
    names.has("vite.config.ts") ||
    names.has("vite.config.js") ||
    dependencyNames.has("vite")
  ) {
    return "vite";
  }
  if (names.has("webpack.config.js") || dependencyNames.has("webpack"))
    return "webpack";
  if (dependencyNames.has("esbuild")) return "esbuild";
  if (names.has("CMakeLists.txt")) return "cmake";
  if (names.has("Makefile")) return "make";
  return pkg?.scripts?.build ? "package script" : undefined;
}

function sanitizeScripts(scripts: unknown): Record<string, string> {
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts))
    return {};
  const allowed = ["dev", "start", "build", "test", "lint"];
  const source = scripts as Record<string, unknown>;
  return Object.fromEntries(
    allowed.flatMap((name) => {
      const value = source[name];
      if (typeof value !== "string") return [];
      return [[name, redactScript(value).slice(0, 500)]];
    })
  );
}

function redactScript(value: string): string {
  return value.replace(
    /(api[_-]?key|authorization|credential|password|secret|token)\s*[:=]\s*[^\s,;]+/gi,
    "$1=[已隐藏]"
  );
}

function toScriptCommand(
  packageManager: string | undefined,
  name: string,
  script?: string
): string | undefined {
  if (!script) return undefined;
  if (packageManager === "yarn") return `yarn ${name}`;
  if (packageManager === "pnpm") return `pnpm ${name}`;
  return `npm run ${name}`;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function isPackageJson(value: unknown): value is PackageJson {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let detector: ProjectDetector | undefined;

export function getProjectDetector(): ProjectDetector {
  detector ??= new ProjectDetector();
  return detector;
}
