import { fetchNovelInfo } from "../lib/narou";

import test from "ava";

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
