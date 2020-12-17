import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const { mkdtemp, writeFile } = fs;

import TextStorage from "../lib/text-storage";

const rimraf = require("rimraf");

let testDir : string;
let storage : TextStorage;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "novlet-test-"), "utf8");
  storage = new TextStorage(testDir);
});

afterEach((done) => {
  rimraf(testDir, done);
});

test("TextStorage#save", async () => {
  expect(await storage.save("hoge")).toBe("ecb666d778725ec97307044d642bf4d160aabb76f56c0069c71ea25b1e926825");
});

test("TextStorage#get with valid hash value", async () => {
  const hash = await storage.save("hoge");
  expect(await storage.get(hash)).toBe("hoge");
});

test("TextStorage#get with invalid hash value", async () => {
  await expect(storage.get("hoge")).rejects.toThrow("No data with the hash 'hoge'");
});

test("TextStorage#get with broken data", async () => {
  await writeFile(join(testDir, "abcd".repeat(16)), "hoge");
  await expect(storage.get("abcd".repeat(16))).rejects.toThrow();
});

test("TextStorage#save multiple times", async () => {
  await storage.save("hoge");
  expect(await storage.save("hoge")).toBe("ecb666d778725ec97307044d642bf4d160aabb76f56c0069c71ea25b1e926825");
});
