import { fetchNovelInfo, scrapeNovelPage } from "./narou";
import axios, { AxiosRequestConfig } from "axios";
import { readFileSync } from "fs";
import { join, extname } from "path";

const MockAdapter = require("axios-mock-adapter");

function fixtureFileResponse(file: string) {
  if (extname(file) === ".json") {
    return [200, JSON.parse(readFileSync(join(__dirname, "__fixture__", file), "utf8"))];
  } else {
    return [200, readFileSync(join(__dirname, "__fixture__", file), "utf8")];
  }
}

beforeAll(() => {
  if (process.env.DISABLE_HTTP_MOCK) { return; }

  const mock = new MockAdapter(axios);
  mock.onGet("https://api.syosetu.com/novelapi/api/").reply((config: AxiosRequestConfig) => {
    if (config.params.ncode === "n2267be") {
      return fixtureFileResponse("rezero.json");
    } else if (config.params.ncode === "n0691cu") {
      return fixtureFileResponse("ss.json");
    } else if (config.params.ncode === "n0312a") {
      return fixtureFileResponse("no_chapter.json");
    } else {
      return [500, null]
    }
  });
  const novelURLRegex = /https:\/\/ncode.syosetu.com\/(.+)\//;
  mock.onGet(novelURLRegex).reply((config: AxiosRequestConfig) => {
    const matchResult = novelURLRegex.exec(config.url!);
    const ncode = matchResult![1];

    if (ncode === "n2267be") {
      return fixtureFileResponse("rezero.html");
    } else if (ncode === "n0691cu") {
      return fixtureFileResponse("ss.html");
    } else if (ncode === "n0312a") {
      return fixtureFileResponse("no_chapter.html");
    } else {
      return [500, null];
    }
  });
});

test("fetchNovelInfo with serial novel", async () => {
  const info = await fetchNovelInfo("n2267be");
  if (!info.isSerial) {
    throw new Error();
  }
  const { title, ncode, userID, writer, story, keywords, isSerial, isContinued, lastUpdatedAt } = info;
  expect(title).toBe("Ｒｅ：ゼロから始める異世界生活");
  expect(ncode).toBe("N2267BE");
  expect(userID).toBe(235132);
  expect(writer).toBe("鼠色猫/長月達平")
  expect(story.startsWith("突如")).toBe(true);
  expect(keywords.includes("残酷な描写あり")).toBe(true);
  expect(isSerial).toBe(true);
  expect(isContinued).toBe(true);
  expect(lastUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
});

test("scrapeNovelPage with serial novel", async () => {
  const info = await fetchNovelInfo("n2267be");
  if (!info.isSerial) { throw new Error(""); }
  const { toc } = await scrapeNovelPage(info);

  const episode = toc.episodes[0];
  expect(episode.id).toBe("1");
  expect(episode.modified).toBe(true);
  expect(episode.publishedAt).toBe("2012-04-20T21:58:00+09:00");
  expect(episode.title).toBe("プロローグ　『始まりの余熱』");

  if (!episode.modified) { throw new Error(""); }

  expect(episode.modifiedAt).toBe("2012-09-01T20:09:00+09:00");

  if (!toc.chapters) { throw new Error(""); }
  expect(toc.chapters[0].title).toBe("第一章　怒涛の一日目");
  expect(toc.chapters[2].episodes).toEqual(["75", "76"]);
});

test("scrapeNovelPage with serial novel which is not chaptered", async () => {
  const info = await fetchNovelInfo("n0312a");
  if (!info.isSerial) { throw new Error(""); }
  const { toc } = await scrapeNovelPage(info);
  expect(toc.chapters).toBeNull();
});

test("fetchNovelInfo with short novel", async () => {
  const info = await fetchNovelInfo("n0691cu");
  expect(info.isSerial).toBe(false);
});

test("scrapeNovelPage with short novel", async () => {
  const info = await fetchNovelInfo("n0691cu");
  if (info.isSerial) { throw new Error(""); }
});
