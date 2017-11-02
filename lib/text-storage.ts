import { createHash } from "crypto";
import { readFile, open, writeFile, close } from "mz/fs";
import { gunzip, gzip } from "mz/zlib";
import { join } from "path";

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
      const fd = await open(join(this.path, hashValue), "wx");
      try {
        await writeFile(fd, compressed);
      } finally {
        await close(fd);
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
    const fileContent = await readFile(join(this.path, hashValue));
    const textBuffer = await gunzip(fileContent);
    const text = textBuffer.toString("utf8");
    if (sha256(text) !== hashValue) {
      throw new Error("Broken data");
    }
    return text;
  }
}
