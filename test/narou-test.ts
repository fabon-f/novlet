import { fetchNovelInfo } from "../lib/narou";
import axios, { AxiosRequestConfig } from "axios";
import { readFileSync } from "fs";
import { join, extname } from "path";

import test from "ava";

const MockAdapter = require("axios-mock-adapter");

function fixtureFileResponse(file: string) {
  if (extname(file) === ".json") {
    return [200, JSON.parse(readFileSync(join(__dirname, "fixture", file), "utf8"))];
  } else {
    return [200, readFileSync(join(__dirname, file), "utf8")];
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
    } else {
      return [500, null]
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

test("fetchNovelInfo with short novel", async (t) => {
  const info = await fetchNovelInfo("n0691cu");
  t.false(info.isSerial);
});
