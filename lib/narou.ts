import axios from "axios";
import * as cheerio from "cheerio";
import { parse, resolve } from "url";

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
  fav_novel_cnt: number;
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

class NovelInfo {
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
  const response = await axios.get("http://api.syosetu.com/novelapi/api/", {
    params: { out: "json", ncode },
  });
  if (response.data[0].allcount === 0) {
    throw new Error("Novel not found");
  }
  const data: NarouAPIResponse = response.data[1];
  return novelInfo(data);
}

function extractEpisode(element: Cheerio): ModifiedEpisode | UnmodifiedEpisode {
  const episodeLink = element.find("a");
  const episodePath = parse(episodeLink.attr("href")).pathname;

  if (episodePath === undefined) { throw new Error("Invalid link"); }

  const id = episodePath.split("/")[2];
  const title = episodeLink.text().trim();
  const episodeDateElement = element.find(".long_update");
  const publishedAt = episodeDateElement.contents().first().text().trim().replace(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2})$/, "$1-$2-$3T$4:00+09:00");

  const episode: Episode = {
    id, title, publishedAt,
  };

  if (episodeDateElement.find("span[title]").length !== 0) {
    const modifiedAt = episodeDateElement.find("span[title]").attr("title").trim().replace(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2}).+/, "$1-$2-$3T$4:00+09:00");
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

function extractTOC($: CheerioStatic): TOC {
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

function extractDownloadID($: CheerioStatic) {
  const downloadURL = $("#novel_footer a[href*=txtdownload]").attr("href");
  const downloadPath = parse(downloadURL).pathname;
  if (downloadPath === undefined) { throw new Error("Invalid download link"); }
  return downloadPath.split("/")[4];
}

export async function scrapeNovelPage(info: SerialNovelInfo): Promise<{ toc: TOC, downloadID: string }>;
export async function scrapeNovelPage(info: ShortNovelInfo): Promise<{ downloadID: string }>;
export async function scrapeNovelPage(info: SerialNovelInfo | ShortNovelInfo) {
  const novelURL = `http://ncode.syosetu.com/${info.ncode.toLowerCase()}/`;
  const response = await axios.get(novelURL);
  const $ = cheerio.load(response.data);

  $("a").each((_, element) => {
    const link = $(element);
    const href = link.attr("href");
    link.attr("href", resolve(novelURL, href).toString());
  });

  const downloadID = extractDownloadID($);

  return info.isSerial ? { toc: extractTOC($), downloadID } : { downloadID };
}
