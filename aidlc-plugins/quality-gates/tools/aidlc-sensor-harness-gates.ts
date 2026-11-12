// aidlc-sensor-harness-gates.ts — AIDLC sensor for the project's own quality gates.
// Runs the gates in `.opencode/plugins/config/harness.config.ts` whose `patterns` match
// the changed file, printing {"pass", "gates_run", "findings"}; exit 0, or 1 if it cannot run.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CONFIG_REL = ".opencode/plugins/config/harness.config.ts";
const DEFAULT_GATE_TIMEOUT_MS = 300_000;
const OVERALL_CAP_MS = 1_800_000;
const OUTPUT_TAIL_CHARS = 1_500;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const TIMEOUT_EXIT_CODE = 124;

interface Gate {
	name: string;
	patterns: string[];
	commands: string[];
	timeoutMs: number;
}
interface Finding {
	gate: string;
	command: string;
	exit_code: number;
	output_tail: string;
}
interface Verdict {
	pass: boolean;
	gates_run: string[];
	findings: Finding[];
}

function fail(reason: string): never {
	process.stderr.write(`aidlc-sensor-harness-gates: ${reason}\n`);
	process.exit(1);
}

function emit(verdict: Verdict): never {
	process.stdout.write(`${JSON.stringify(verdict)}\n`);
	process.exit(0);
}

function tail(text: string, max: number): string {
	const trimmed = text.trimEnd();
	return trimmed.length <= max ? trimmed : trimmed.slice(-max);
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

// Every flag takes a value; unknown flags are ignored with their value so a new
// dispatcher flag never turns a fire into a hard failure.
function parseArgs(argv: string[]): string[] {
	const paths: string[] = [];
	for (let i = 0; i < argv.length; i += 1) {
		const [flag, inline] = (argv[i] ?? "").split(/=(.*)/s);
		const value = inline ?? argv[i + 1] ?? "";
		if (inline === undefined) i += 1;
		if (flag === "--file-path" && value) paths.push(value);
	}
	return paths;
}

function changedPaths(explicit: string[]): string[] {
	if (explicit.length > 0) return explicit;
	if (process.stdin.isTTY === true) return [];
	let text = "";
	try {
		text = readFileSync(0, "utf-8");
	} catch {
		return [];
	}
	if (!text.trim()) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		fail(`could-not-run: stdin is not valid JSON: ${tail(text, 200)}`);
	}
	if (!Array.isArray(parsed)) fail("could-not-run: stdin must be a JSON array of paths");
	return parsed.map((entry) => String(entry)).filter((entry) => entry.length > 0);
}

function findRoot(filePath: string): string | null {
	const cwd = process.cwd();
	if (existsSync(join(cwd, CONFIG_REL))) return cwd;
	let dir = dirname(resolve(filePath));
	while (!existsSync(join(dir, CONFIG_REL))) {
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
	return dir;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}
function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function parseGate(entry: unknown, index: number): Gate {
	const record = asRecord(entry);
	const timeoutMs = record?.timeoutMs;
	if (!record || typeof record.name !== "string" || !isStringArray(record.patterns) || !isStringArray(record.commands)) {
		fail(`could-not-run: gate #${index} is malformed; expected {name, patterns[], commands[]}`);
	}
	return {
		name: record.name,
		patterns: record.patterns,
		commands: record.commands,
		timeoutMs: typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : DEFAULT_GATE_TIMEOUT_MS,
	};
}

async function loadGates(root: string): Promise<Gate[]> {
	const configPath = join(root, CONFIG_REL);
	if (!existsSync(configPath)) fail(`could-not-run: missing gate config ${configPath}`);
	let configModule: unknown;
	try {
		configModule = await import(pathToFileURL(configPath).href);
	} catch (error) {
		fail(`could-not-run: cannot import ${configPath}: ${describe(error)}`);
	}
	const plugins = asRecord(asRecord(configModule)?.harnessConfig)?.plugins;
	const entries = asRecord(asRecord(plugins)?.["quality-gate-enforcer"])?.gates;
	if (!Array.isArray(entries)) {
		fail(`could-not-run: ${CONFIG_REL} exports no plugins['quality-gate-enforcer'].gates array`);
	}
	return entries.map((entry, index) => parseGate(entry, index));
}

function wildcardSegment(segment: string): string {
	return segment
		.split("*")
		.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("[^/]*");
}

// `**` as a whole segment matches zero or more segments, so `**/*.py` also matches
// a root-level file; `*` never crosses a `/`; anything else is literal, which
// covers bare names (`justfile`) and one-segment globs (`*/justfile`).
function globToRegExp(pattern: string): RegExp {
	const segments = pattern.replaceAll("\\", "/").replace(/^\.\//, "").split("/");
	let source = "^";
	segments.forEach((segment, index) => {
		const last = index === segments.length - 1;
		if (segment === "**") {
			source += last ? ".*" : "(?:[^/]+/)*";
			return;
		}
		source += wildcardSegment(segment);
		if (!last) source += "/";
	});
	return new RegExp(`${source}$`);
}

const repoRelative = (root: string, filePath: string): string | null => {
	const rel = relative(root, resolve(filePath));
	return !rel || rel.startsWith("..") || isAbsolute(rel) ? null : posix.normalize(rel.replaceAll("\\", "/"));
};

function runCommand(gate: Gate, command: string, root: string, timeoutMs: number): Finding {
	const result = spawnSync(command, {
		cwd: root, shell: true, encoding: "utf-8", timeout: timeoutMs, maxBuffer: MAX_BUFFER_BYTES, stdio: ["ignore", "pipe", "pipe"],
	});
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	const exitCode = typeof result.status === "number" ? result.status : TIMEOUT_EXIT_CODE;
	return { gate: gate.name, command, exit_code: exitCode, output_tail: tail(output, OUTPUT_TAIL_CHARS) };
}

function runGates(gates: Gate[], root: string): Verdict {
	const deadline = Date.now() + OVERALL_CAP_MS;
	const gatesRun: string[] = [];
	const findings: Finding[] = [];
	let started = 0;
	let total = 0;
	for (const gate of gates) {
		for (const command of gate.commands) {
			total += 1;
			const remaining = deadline - Date.now();
			if (remaining <= 0) {
				const capNote = `not started: overall ${OVERALL_CAP_MS} ms cap reached`;
				findings.push({ gate: gate.name, command, exit_code: TIMEOUT_EXIT_CODE, output_tail: capNote });
				continue;
			}
			started += 1;
			if (!gatesRun.includes(gate.name)) gatesRun.push(gate.name);
			const finding = runCommand(gate, command, root, Math.min(gate.timeoutMs, remaining));
			if (finding.exit_code !== 0) findings.push(finding);
		}
	}
	if (started === 0 && total > 0) fail("could-not-run: no gate command could start");
	return { pass: findings.length === 0, gates_run: gatesRun, findings };
}

async function run(argv: string[]): Promise<void> {
	const paths = changedPaths(parseArgs(argv));
	const [first] = paths;
	if (first === undefined) emit({ pass: true, gates_run: [], findings: [] });
	const root = findRoot(first);
	if (!root) fail(`could-not-run: no project root containing ${CONFIG_REL} above ${resolve(first)}`);
	const gates = await loadGates(root);
	const relatives = paths.map((path) => repoRelative(root, path)).filter((path): path is string => path !== null);
	const matching = gates.filter((gate) => relatives.some((path) => gate.patterns.some((pattern) => globToRegExp(pattern).test(path))));
	emit(runGates(matching, root));
}

// The sensor worker imports this module and calls main(argv): emit() and fail()
// exit the process, so the async run below is the whole entry point.
export function main(argv: string[]): void {
	run(argv).catch((error: unknown) => fail(`unexpected failure: ${describe(error)}`));
}

// Bun-only flag; the standard ImportMeta type has no `main`, so a plain script
// always runs when the compiler cannot see it.
const invokedAsScript = (import.meta as ImportMeta & { main?: boolean }).main ?? true;

if (invokedAsScript) main(process.argv.slice(2));
