import { createHash } from "crypto";
import { promises as fs } from "fs";
import * as zlib from "zlib";
import { promisify } from "util"
import { join } from "path";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const sha256 = (data: string | Buffer) => {
  const hash = createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
};

export default class TextStorage {
  constructor(private path: string) {}
  async save(text: string) {
    const hashValue = sha256(text);
    const compressed = await gzip(Buffer.from(text));
    try {
      const fileHandle = await fs.open(join(this.path, hashValue), "wx");
      try {
        await fileHandle.writeFile(compressed);
      } finally {
        await fileHandle.close();
      }
      return hashValue;
    } catch (e) {
      if (e.code === "EEXIST") {
        return hashValue;
      } else {
        throw e;
      }
    }
  }
  async get(hashValue: string) {
    const fileContent = await fs.readFile(join(this.path, hashValue));
    const textBuffer = await gunzip(fileContent);
    const text = textBuffer.toString("utf8");
    if (sha256(text) !== hashValue) {
      throw new Error("Broken data");
    }
    return text;
  }
}
