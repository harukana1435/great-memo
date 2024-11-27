import { Client } from "@notionhq/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Notionクライアントの初期化
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      // リクエストボディをパース
      const { tabId, tabContent } = req.body;
      const databaseId = process.env.NOTION_DATABASE_ID;

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const prompt = `
入力文で示される文章をNotionのマークアップ形式で出力してください。
文章の内容を誤字や表現を修正し、必要に応じてわかりやすくしても構いません。

出力する際の形式:
## Title: 入力文の最初の20文字以内でタイトルをつけてください。
## 内容:
修正後の文章をNotionマークアップ形式で記述してください。
## クイズ:
入力の内容に基づいた簡単なクイズを複数問作成してください。

入力文:
${text}
      `;

      const result = await model.generateContentStream(prompt);

      let result_text = "";

      for await (const chunk of result.stream) {
        result_text += chunk.text();
      }

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
        },
        "children": [
          {
            object: "block",
            type: "paragraph", // 段落として子ブロックを追加
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: result_text, // tabContent全体をそのまま追加
                  },
                },
              ],
            },
          },
        ],
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
