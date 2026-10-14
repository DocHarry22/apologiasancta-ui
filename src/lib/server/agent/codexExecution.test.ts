import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
import { executeCodex } from "./codexModel";
let child: EventEmitter & {stdin:PassThrough;stdout:PassThrough;stderr:PassThrough;pid:number;kill:ReturnType<typeof vi.fn>};
beforeEach(() => {
  vi.stubEnv("GITHUB_ACTIONS", "false");
  child = Object.assign(new EventEmitter(), {stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),pid:12345,kill:vi.fn(()=>true)});
  vi.mocked(spawn).mockReturnValue(child as unknown as ChildProcessWithoutNullStreams);
  vi.spyOn(process,"kill").mockReturnValue(true);
});
afterEach(() => {vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllEnvs();});
describe("bounded private Codex process execution", () => {
  it("collects a completed process without invoking a shell", async () => {
    const pending = executeCodex(["exec"],"safe input","/tmp"); child.stdout.write('{"type":"turn.completed"}\n'); child.emit("close",0);
    expect((await pending).code).toBe(0); expect(spawn).toHaveBeenCalledWith(expect.anything(),["exec"],expect.objectContaining({shell:false,detached:process.platform!=="win32"}));
  });
  it("kills the process group and closes inherited pipes on timeout", async () => {
    vi.useFakeTimers(); const pending = executeCodex([],"","/tmp",1000); const rejected = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(1000); await rejected;
    if(process.platform!=="win32")expect(process.kill).toHaveBeenCalledWith(-12345,"SIGKILL");else expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    expect(child.stdout.destroyed).toBe(true); expect(child.stderr.destroyed).toBe(true);
  });
  it("terminates oversized output without exposing process logs", async () => {
    const pending = executeCodex([],"","/tmp"); const rejected = expect(pending).rejects.toThrow(/output exceeded/); child.stdout.write(Buffer.alloc(3*1024*1024)); await rejected;
  });
});
