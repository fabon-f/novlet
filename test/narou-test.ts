import { fetchNovelInfo, scrapeNovelPage } from "../lib/narou";
import axios, { AxiosRequestConfig } from "axios";
import { readFileSync } from "fs";
import { join, extname } from "path";

import test from "ava";

const MockAdapter = require("axios-mock-adapter");

function fixtureFileResponse(file: string) {
  if (extname(file) === ".json") {
    return [200, JSON.parse(readFileSync(join(__dirname, "fixture", file), "utf8"))];
  } else {
    return [200, readFileSync(join(__dirname, "fixture", file), "utf8")];
  }
}

test.before(() => {
  if (process.env.DISABLE_HTTP_MOCK) { return; }

  const mock = new MockAdapter(axios);
  mock.onGet("http://api.syosetu.com/novelapi/api/").reply((config: AxiosRequestConfig) => {
    if (config.params.ncode === "n2267be") {
      return fixtureFileResponse("rezero.json");
    } else if (config.params.ncode === "n0691cu") {
      return fixtureFileResponse("ss.json");
    } else if (config.params.ncode === "n6492dp") {
      return fixtureFileResponse("vrmmo.json");
    } else {
      return [500, null]
    }
  });
  const novelURLRegex = /http:\/\/ncode.syosetu.com\/(.+)\//;
  mock.onGet(novelURLRegex).reply((config: AxiosRequestConfig) => {
    const matchResult = novelURLRegex.exec(config.url!);
    const ncode = matchResult![1];

    if (ncode === "n2267be") {
      return fixtureFileResponse("rezero.html");
    } else if (ncode === "n0691cu") {
      return fixtureFileResponse("ss.html");
    } else if (ncode === "n6492dp") {
      return fixtureFileResponse("vrmmo.html");
    } else {
      return [500, null];
    }
  });
});

test("fetchNovelInfo with serial novel", async (t) => {
  const info = await fetchNovelInfo("n2267be");
  if (!info.isSerial) {
    throw new Error();
  }
  const { title, ncode, userID, writer, story, keywords, isSerial, isContinued, lastUpdatedAt } = info;
  t.is(title, "Ｒｅ：ゼロから始める異世界生活");
  t.is(ncode, "N2267BE");
  t.is(userID, 235132);
  t.is(writer, "鼠色猫/長月達平");
  t.true(story.startsWith("突如"));
  t.true(keywords.includes("残酷な描写あり"));
  t.true(isSerial);
  t.true(isContinued);
  t.regex(lastUpdatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
});

test("scrapeNovelPage with serial novel", async (t) => {
  const info = await fetchNovelInfo("n2267be");
  if (!info.isSerial) { throw new Error(""); }
  const { downloadID, toc } = await scrapeNovelPage(info);
  t.is(downloadID, "302237");

  const episode = toc.episodes[0];
  t.is(episode.id, "1");
  t.true(episode.modified);
  t.is(episode.publishedAt, "2012-04-20T21:58:00+09:00");
  t.is(episode.title, "プロローグ　『始まりの余熱』");

  if (!episode.modified) { throw new Error(""); }

  t.is(episode.modifiedAt, "2012-09-01T20:09:00+09:00");

  if (!toc.chapters) { throw new Error(""); }
  t.is(toc.chapters[0].title, "第一章　怒涛の一日目");
  t.deepEqual(toc.chapters[2].episodes, ["75", "76"]);
});

test("scrapeNovelPage with serial novel which is not chaptered", async (t) => {
  const info = await fetchNovelInfo("n6492dp");
  if (!info.isSerial) { throw new Error(""); }
  const { toc } = await scrapeNovelPage(info);
  t.is(toc.chapters, null);
});

test("fetchNovelInfo with short novel", async (t) => {
  const info = await fetchNovelInfo("n0691cu");
  t.false(info.isSerial);
});

test("scrapeNovelPage with short novel", async (t) => {
  const info = await fetchNovelInfo("n0691cu");
  if (info.isSerial) { throw new Error(""); }
  const { downloadID } = await scrapeNovelPage(info);
  t.is(downloadID, "720619");
});
