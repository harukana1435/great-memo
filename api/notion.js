import { Client } from "@notionhq/client";

// Notionクライアントの初期化
const notion = new Client({ auth: process.env.NOTION_API_KEY });

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      // リクエストボディをパース
      const { tabId, tabContent } = req.body;
      const databaseId = process.env.NOTION_DATABASE_ID;
      console.log(tabId);
      console.log(tabContent);

      const result2 = await notion.databases.query({ database_id: databaseId });
      console.log(JSON.stringify(result2.results[0]));

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
        console.log(pageId);
        await notion.pages.update({
          "page_id": pageId,
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
                  "text": { "content": tabContent, "link": null },
                  "annotations": {
                    "bold": false,
                    "italic": false,
                    "strikethrough": false,
                    "underline": false,
                    "code": false,
                    "color": "default",
                  },
                  "plain_text": tabContent,
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
                      content: tabContent, // tabContent全体をそのまま追加
                    },
                  },
                ],
              },
            },
          ],
        });

        res.status(200).json({ message: "Page updated successfully" });
      } else {
        // 同じIDのページが見つからない場合、新しいページを作成
        console.log(tabContent);
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
                  "text": { "content": tabContent, "link": null },
                  "annotations": {
                    "bold": false,
                    "italic": false,
                    "strikethrough": false,
                    "underline": false,
                    "code": false,
                    "color": "default",
                  },
                  "plain_text": tabContent,
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
                      content: tabContent, // tabContent全体をそのまま追加
                    },
                  },
                ],
              },
            },
          ],
        });

        res.status(200).json({ message: "Page created successfully" });
      }
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}
