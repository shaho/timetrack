/**
 * Idle seconds since last keyboard/mouse input, via macOS `ioreg`.
 *
 * HIDIdleTime is reported in nanoseconds by the IOHIDSystem service.
 * Shelling out avoids any native Node module (no node-gyp), which keeps
 * the daemon pure TypeScript and Bun-friendly.
 */
export async function idleSeconds(): Promise<number> {
  const proc = Bun.spawn(["ioreg", "-c", "IOHIDSystem", "-d", "4"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;

  const match = out.match(/"HIDIdleTime"\s*=\s*(\d+)/);
  if (!match || !match[1]) return 0;
  return Number(match[1]) / 1e9;
}
