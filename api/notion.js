import { Client } from "@notionhq/client";
import { markdownToBlocks } from "@tryfabric/martian";

// Notionクライアントの初期化
const notion = new Client({ auth: process.env.NOTION_API_KEY });

function extractUrlsAndTitles(content) {
  const urlRegex = /(https?:\/\/[^\s]+)/g; // URLを抽出する正規表現
  const lines = content.split("\n"); // 改行で文章を分割
  const results = [];
  let counter = 1; // URLに付ける番号のカウンタ

  // contentを行ごとに処理して新しい内容を作成
  let updatedContent = "";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let lineUpdated = line;

    const match = line.match(urlRegex); // URLを探す

    if (match) {
      // URLが見つかった場合、1行前をタイトルとして抽出
      const title = i > 0 ? lines[i - 1].trim() : "タイトルなし";
      const url = match[0];

      // タイトルとURLを組み合わせてリンクテキストを生成
      const linkText = `[${title}](${url})`;

      // 結果に番号付きでURLとタイトルを追加
      results.push({ number: counter, url: url, title: title });
      counter++;

      // リンクテキストに置き換え
      lineUpdated = lineUpdated.replace(url, linkText);

      // 1行前のタイトルは消す（行が繰り返し処理されないように）
      if (i > 0) {
        lines[i - 1] = ""; // 前の行を空にする
      }
    }

    // 行ごとに更新された内容を追加
    updatedContent += lineUpdated + "\n";
  }

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
