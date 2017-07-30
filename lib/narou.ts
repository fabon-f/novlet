import axios from "axios";

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
