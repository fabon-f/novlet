import axios from "axios";
import * as cheerio from "cheerio";

interface NarouAPIResponse {
  title: string;
  ncode: string;
  userid: number;
  writer: string;
  story: string;
  biggenre: number;
  genre: number;
  keyword: string;
  general_firstup: string;
  general_lastup: string;
  novel_type: 1 | 2;
  end: 0 | 1;
  general_all_no: number;
  length: number;
  time: number;
  isstop: 0 | 1;
  isr15: 0 | 1;
  isbl: 0 | 1;
  isgl: 0 | 1;
  iszankoku: 0 | 1;
  istensei: 0 | 1;
  istenni: 0 | 1;
  pc_or_k: 1 | 2 | 3;
  global_point: number;
  daily_point: number;
  weekly_point: number;
  monthly_point: number;
  quarter_point: number;
  yearly_point: number;
  fav_novel_cnt: number;
  impression_cnt: number;
  review_cnt: number;
  all_point: number;
  all_hyoka_cnt: number;
  sasie_cnt: number;
  kaiwaritu: number;
  novelupdated_at: string;
  updated_at: string;
}

function formatISODate(str: string) {
  return str.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, "$1T$2+09:00");
}

interface NovelInfo {
  title: string;
  ncode: string;
  userID: number;
  writer: string;
  story: string;
  keywords: string[];
  genre: number;
  /**
   * ISO 8601 compliant time(with timezone)
   */
  lastUpdatedAt: string;
}

interface SerialNovelInfo extends NovelInfo {
  isSerial: true;
  isContinued: boolean;
  episodeCount: number;
}

interface ShortNovelInfo extends NovelInfo {
  isSerial: false;
}

interface Chapter {
  title: string;
  episodes: string[];
}

interface Episode {
  title: string;
  id: string;
  /**
   * ISO 8601 compliant time(with timezone)
   */
  publishedAt: string;
}

interface UnmodifiedEpisode extends Episode {
  modified: false;
}

interface ModifiedEpisode extends Episode {
  modified: true;
  /**
   * ISO 8601 compliant time(with timezone)
   */
  modifiedAt: string;
}

function novelInfo(res: NarouAPIResponse): SerialNovelInfo | ShortNovelInfo {
  const { title, ncode, userid, writer, story, keyword, genre } = res;
  const generalInfo: NovelInfo = {
    title,
    ncode,
    userID: userid,
    writer,
    story,
    genre,
    keywords: keyword.split(" "),
    lastUpdatedAt: formatISODate(res.novelupdated_at)
  };

  if (res.novel_type == 2) {
    return {
      ...generalInfo,
      isSerial: false,
    };
  } else {
    return {
      ...generalInfo,
      isSerial: true,
      isContinued: res.end === 1,
      episodeCount: res.general_all_no,
    };
  }
}

export async function fetchNovelInfo(ncode: string) {
  const response = await axios.get("https://api.syosetu.com/novelapi/api/", {
    params: { out: "json", ncode },
  });
  if (response.data[0].allcount === 0) {
    throw new Error("Novel not found");
  }
  const data: NarouAPIResponse = response.data[1];
  return novelInfo(data);
}

function extractEpisode(element: cheerio.Cheerio): ModifiedEpisode | UnmodifiedEpisode {
  const episodeLink = element.find("a");
  const episodeURL = episodeLink.attr("href");
  if (episodeURL === undefined) { throw new Error("Invalid link"); }

  const id = new URL(episodeURL).pathname.split("/")[2];
  if (id === undefined) { throw new Error("Invalid link"); }
  const title = episodeLink.text().trim();
  const episodeDateElement = element.find(".long_update");
  const publishedAt = episodeDateElement.contents().first().text().trim().replace(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2})$/, "$1-$2-$3T$4:00+09:00");

  const episode: Episode = {
    id, title, publishedAt,
  };

  if (episodeDateElement.find("span[title]").length !== 0) {
    const episodeDateElementTitle = episodeDateElement.find("span[title]").attr("title");
    if (episodeDateElementTitle === undefined) { throw new Error("Invalid link"); }
    const modifiedAt = episodeDateElementTitle.trim().replace(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2}).+/, "$1-$2-$3T$4:00+09:00");
    return {
      ...episode,
      modified: true,
      modifiedAt,
    };
  } else {
    return {
      ...episode,
      modified: false,
    };
  }
}

interface TOC {
  chapters: Chapter[] | null;
  episodes: Array<ModifiedEpisode | UnmodifiedEpisode>;
}

function extractTOC($: cheerio.Root): TOC {
  const chapters = [];
  const episodes: Array<ModifiedEpisode | UnmodifiedEpisode> = [];
  const elements = $(".index_box .chapter_title, .index_box .novel_sublist2").toArray();
  const hasChapters = $(elements[0]).hasClass("chapter_title");
  for (const e of elements) {
    const element = $(e);
    if (element.hasClass("chapter_title")) {
      const chapter: Chapter = {
        title: element.text().trim(),
        episodes: [],
      };
      chapters.push(chapter);
    } else {
      const episode = extractEpisode(element);
      episodes.push(episode);

      if (hasChapters) {
        chapters[chapters.length - 1].episodes.push(episode.id);
      }
    }
  }

  return {
    chapters: hasChapters ? chapters : null,
    episodes,
  };
}

export async function scrapeNovelPage(info: SerialNovelInfo): Promise<{ toc: TOC }>;
export async function scrapeNovelPage(info: ShortNovelInfo): Promise<{}>;
export async function scrapeNovelPage(info: SerialNovelInfo | ShortNovelInfo) {
  const novelURL = `https://ncode.syosetu.com/${info.ncode.toLowerCase()}/`;
  const response = await axios.get(novelURL, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.3764.0 Safari/537.36" } });
  const $ = cheerio.load(response.data);

  $("a").each((_, element) => {
    const link = $(element);
    const href = link.attr("href");
    if (href === undefined) { return; }
    link.attr("href", new URL(href, novelURL).toString());
  });

  return info.isSerial ? { toc: extractTOC($) } : {};
}
