import { spawn } from "node:child_process";
import net from "node:net";

const START_PORT = Number(process.env.CGD_SMOKE_PORT ?? 4273);
const MAX_PORT = START_PORT + 80;

const port = await findOpenPort(START_PORT, MAX_PORT);
const command = process.env.npm_execpath ? process.execPath : "npx";
const args = process.env.npm_execpath
  ? [process.env.npm_execpath, "exec", "--", "playwright", "test", ...process.argv.slice(2)]
  : ["playwright", "test", ...process.argv.slice(2)];
const child = spawn(command, args, {
  env: {
    ...process.env,
    CGD_SMOKE_PORT: String(port),
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

function findOpenPort(start, max) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > max) {
        reject(new Error(`No open smoke-test port found between ${start} and ${max}.`));
        return;
      }
      const server = net.createServer();
      server.once("error", () => tryPort(port + 1));
      server.once("listening", () => {
        server.close(() => resolve(port));
      });
      server.listen(port, "127.0.0.1");
    };
    tryPort(start);
  });
}
