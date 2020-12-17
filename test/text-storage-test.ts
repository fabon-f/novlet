import test from "ava";

import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const { mkdtemp, writeFile } = fs;

import TextStorage from "../lib/text-storage";

const rimraf = require("rimraf");

test.beforeEach(async (t) => {
  const testDir = await mkdtemp(join(tmpdir(), "novlet-test-"), "utf8");
  const storage = new TextStorage(testDir);
  t.context.dir = testDir;
  t.context.storage = storage;
});

test.afterEach.always.cb((t) => {
  rimraf(t.context.dir, t.end);
});

test("TextStorage#save", async (t) => {
  const storage: TextStorage = t.context.storage;
  t.is(await storage.save("hoge"), "ecb666d778725ec97307044d642bf4d160aabb76f56c0069c71ea25b1e926825");
});

test("TextStorage#get with valid hash value", async (t) => {
  const storage: TextStorage = t.context.storage;
  const hash = await storage.save("hoge");
  t.is(await storage.get(hash), "hoge");
});

test("TextStorage#get with invalid hash value", async (t) => {
  const storage: TextStorage = t.context.storage;
  await t.throws(storage.get("hoge"));
});

test("TextStorage#get with broken data", async (t) => {
  const storage: TextStorage = t.context.storage;
  await writeFile(join(t.context.dir, "abcd".repeat(16)), "hoge");
  await t.throws(storage.get("abcd".repeat(16)));
});

test("TextStorage#save multiple times", async (t) => {
  const storage: TextStorage = t.context.storage;
  await storage.save("hoge");
  t.is(await storage.save("hoge"), "ecb666d778725ec97307044d642bf4d160aabb76f56c0069c71ea25b1e926825");
});
