import { fork, spawn, execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const RENDER_PROFILE = "render-1c-2g";
export const SERVER_IMAGE = "node:22.16.0-bookworm-slim";
const IPC_PREFIX = "arena-load-ipc ";
const exec = promisify(execFile);

/** Refuse a capacity result if Docker did not apply both production limits. */
export function verifyRenderLimits(cpuMax, memoryMax) {
  const [quota, period] = cpuMax.trim().split(/\s+/).map(Number);
  const memoryBytes = Number(memoryMax.trim());
  if (
    !(quota > 0 && period > 0 && quota / period === 1) ||
    memoryBytes !== 2 ** 31
  )
    throw new Error(
      `Expected 1 CPU / 2 GiB; got cpu.max=${cpuMax.trim()}, memory.max=${memoryMax.trim()}`,
    );
  return { profile: RENDER_PROFILE, verified: true, cpu: 1, memoryBytes };
}

// Docker has no Node IPC descriptor. Carry the same messages over stdin/stdout,
// keeping ordinary game logs on their own lines. This preload is test-only.
if (process.env.ARENA_LOAD_STDIO_IPC === "1") {
  process.send = (message) => {
    if (message.type === "ready") {
      const resources = verifyRenderLimits(
        readFileSync("/sys/fs/cgroup/cpu.max", "utf8"),
        readFileSync("/sys/fs/cgroup/memory.max", "utf8"),
      );
      message = {
        ...message,
        resources: { ...resources, node: process.version },
      };
    }
    process.stdout.write(IPC_PREFIX + JSON.stringify(message) + "\n");
    return true;
  };
  createInterface({ input: process.stdin }).on("line", (line) =>
    process.emit("message", JSON.parse(line)),
  );
  // The driver was interrupted: do not leave a fake-account server running.
  process.stdin.once("end", () => process.exit(0));
}

/**
 * Only the server is limited; the load generator stays on the host. Linux/cgroup v2.
 * @returns {Promise<{ child: EventEmitter & { send(message: object): void, close(): Promise<void> }, port: number, resources: Record<string, unknown> }>}
 */
export async function startLoadServer(
  profile = RENDER_PROFILE,
  image = SERVER_IMAGE,
) {
  if (profile !== RENDER_PROFILE && profile !== "host")
    throw new Error(
      `Unknown profile ${profile}; use ${RENDER_PROFILE} or host`,
    );
  if (process.env.CGROUP)
    throw new Error(
      "CGROUP is no longer used; the default Docker profile enforces 1 CPU / 2 GiB. Use --profile host for an explicitly uncapped run.",
    );
  if (profile === RENDER_PROFILE && process.platform !== "linux")
    throw new Error(
      "The Render profile needs Linux Docker with host networking and cgroup v2; --profile host is uncapped.",
    );
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const entry = fileURLToPath(new URL("./load-server.ts", import.meta.url));
  const nodeArgs = [
    "--import",
    "tsx",
    "--expose-gc",
    ...(process.env.SERVER_NODE_ARGS?.split(" ").filter(Boolean) ?? []),
  ];
  const name = `arena-perf-${process.pid}-${Date.now()}`;
  const docker = profile === RENDER_PROFILE;
  const proc = docker
    ? spawn(
        "docker",
        [
          "run",
          "--rm",
          "--interactive",
          "--name",
          name,
          "--cpus=1",
          "--memory=2g",
          "--memory-swap=2g",
          "--network=host",
          "--mount",
          `type=bind,src=${root},dst=${root},readonly`,
          "--workdir",
          root,
          "--env",
          "ARENA_LOAD_STDIO_IPC=1",
          image,
          "node",
          ...nodeArgs,
          "--import",
          fileURLToPath(import.meta.url),
          entry,
        ],
        { stdio: ["pipe", "pipe", "inherit"] },
      )
    : fork(entry, {
        execArgv: nodeArgs,
        stdio: ["ignore", "inherit", "inherit", "ipc"],
      });
  const channel = new EventEmitter();
  let alive = true;
  const exited = new Promise((resolve) =>
    proc.once("exit", (code, signal) => {
      alive = false;
      channel.emit(
        "failure",
        new Error(`Load server exited (${code ?? signal})`),
      );
      resolve();
    }),
  );
  proc.on("error", (error) => {
    alive = false;
    channel.emit("failure", error);
  });
  channel.send = (message) => {
    if (!alive) throw new Error("Load server is no longer running");
    if (docker) proc.stdin.write(JSON.stringify(message) + "\n");
    else proc.send(message);
  };
  const terminate = async () => {
    if (!alive) return;
    if (docker)
      await exec("docker", ["rm", "--force", name], { timeout: 10_000 }).catch(
        () => {},
      );
    proc.kill();
  };
  channel.close = async () => {
    if (!alive) return;
    channel.send({ cmd: "close" });
    let timer;
    try {
      await Promise.race([
        exited,
        new Promise((resolve) => {
          timer = setTimeout(resolve, 10_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      await terminate();
    }
  };
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error("Load server did not become ready within 120 seconds"),
        ),
      120_000,
    );
    const fail = (error) => {
      clearTimeout(timer);
      reject(error);
    };
    channel.once("failure", fail);
    const onMessage = (message) => {
      if (message.type !== "ready") return;
      if (docker && message.resources?.verified !== true)
        return fail(
          new Error("The Render profile did not verify its cgroup limits"),
        );
      clearTimeout(timer);
      channel.off("failure", fail);
      channel.off("message", onMessage);
      resolve({
        child: channel,
        port: message.port,
        resources: message.resources ?? {
          profile: "host",
          verified: false,
          node: process.version,
        },
      });
    };
    channel.on("message", onMessage);
  });
  if (docker)
    createInterface({ input: proc.stdout }).on("line", (line) => {
      if (line.startsWith(IPC_PREFIX))
        channel.emit("message", JSON.parse(line.slice(IPC_PREFIX.length)));
      else console.error(line);
    });
  else proc.on("message", (message) => channel.emit("message", message));
  try {
    return await ready;
  } catch (error) {
    await terminate();
    throw error;
  }
}

/** A dead child or missing reply must fail instead of hanging a benchmark. */
export function ask(child, command, type, timeout = 15_000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("failure", fail);
    };
    const fail = (error) => {
      cleanup();
      reject(error);
    };
    const onMessage = (message) => {
      if (message.type !== type) return;
      cleanup();
      resolve(message);
    };
    const timer = setTimeout(
      () => fail(new Error(`Load server did not reply to ${command.cmd}`)),
      timeout,
    );
    child.on("message", onMessage);
    child.once("failure", fail);
    try {
      child.send(command);
    } catch (error) {
      fail(error);
    }
  });
}
