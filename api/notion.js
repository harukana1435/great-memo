import { Client } from "@notionhq/client";
import { markdownToBlocks } from "@tryfabric/martian";

// Notionクライアントの初期化
const notion = new Client({ auth: process.env.NOTION_API_KEY });

function extractUrlsAndTitles(content) {
  const urlRegex = /(https?:\/\/[^\s]+)/g; // URLを抽出する正規表現
  const lines = content.split("\n"); // 改行で文章を分割
  const results = [];
  let counter = 1; // URLに付ける番号のカウンタ
  let linecount = 0;

  // contentを行ごとに処理して新しい内容を作成
  const updatedContent = lines
    .map((line) => {
      linecount++;
      return line.replace(urlRegex, (match) => {
        const url = match;
        const title =
          linecount > 0 ? lines[counter - 1].trim() : "タイトルなし"; // URLの1行前をタイトルとして抽出
        results.push({ number: counter, url: url, title: title }); // 番号を含む結果を追加
        const linkText = `[${counter}](${url})`; // 番号付きのハイパーリンクを生成
        counter++;
        return linkText; // URLを番号付きリンクに置き換え
      });
    })
    .join("\n");

  return { updatedContent, results }; // 置き換え後のcontentと結果を返す
}

function extractTop(content) {
  const lines = content.split("\n");
  if (lines.length !== 0) {
    return lines[0];
  } else {
    return "タイトルなし";
  }
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      // リクエストボディをパース
      const { tabId, tabContent } = req.body;
      const databaseId = process.env.NOTION_DATABASE_ID;
      console.log(tabContent);

      const title = extractTop(tabContent);

      // 入力文からURLを抽出し、対応するタイトルを生成し、番号リンクを適用
      const { updatedContent, results } = extractUrlsAndTitles(tabContent);

      const blocks = markdownToBlocks(
        "### 関連資料\n" +
          results
            .map(
              (detail) =>
                `- [${detail.number}. ${detail.title}](${detail.url})`,
            )
            .join("\n") +
          "\nーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー\n" +
          updatedContent,
      );
      console.log(blocks);

      // データベース内のページを検索
      const searchResponse = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: "tabID", // データベースのプロパティ名
          rich_text: {
            equals: tabId,
          },
        },
      });

      if (searchResponse.results.length > 0) {
        // 同じIDのページが見つかった場合、そのページを更新
        const pageId = searchResponse.results[0].id;
        await notion.pages.update({
          page_id: pageId,
          archived: true,
        });
      }

      await notion.pages.create({
        "parent": { "type": "database_id", "database_id": databaseId },
        "properties": {
          "tabID": {
            "id": "Y%3Axu",
            "type": "rich_text",
            "rich_text": [
              {
                "type": "text",
                "text": { "content": tabId, "link": null },
                "annotations": {
                  "bold": false,
                  "italic": false,
                  "strikethrough": false,
                  "underline": false,
                  "code": false,
                  "color": "default",
                },
                "plain_text": tabId,
                "href": null,
              },
            ],
          },
          "Name": {
            "id": "title",
            "type": "title",
            "title": [
              {
                "type": "text",
                "text": { "content": title, "link": null },
                "annotations": {
                  "bold": false,
                  "italic": false,
                  "strikethrough": false,
                  "underline": false,
                  "code": false,
                  "color": "default",
                },
                "plain_text": results.tabTitle,
                "href": null,
              },
            ],
          },
        },
        "children": blocks,
      });

      res.status(200).json({ message: "Page created successfully" });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}
