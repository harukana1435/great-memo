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
          page_id: pageId,
          properties: {
            tabID: {
              rich_text: [
                {
                  text: {
                    content: tabId, // tabIdをtabIDプロパティに設定
                  },
                },
              ],
            },
            Memo: {
              title: [
                {
                  text: {
                    content: tabContent.substring(0, 10), // tabContentの10文字目までをタイトルに
                  },
                },
              ],
            },
            children: [
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
          },
        });

        res.status(200).json({ message: "Page updated successfully" });
      } else {
        // 同じIDのページが見つからない場合、新しいページを作成
        console.log(tabContent);
        await notion.pages.create({
          "parent": { "type": "database_id", "database_id": databaseId },
          "properties": {
            "Name": {
              "title": [
                {
                  "type": "text",
                  "text": {
                    "content": tabContent.substring(0, 10), // tabIdをtabIDプロパティに設定
                  },
                },
              ],
            },
            "tabID": {
              "rich_text": [
                {
                  "text": {
                    "content": tabId, // tabContentの10文字目までをタイトルに
                  },
                },
              ],
            },
            "children": [
              {
                "object": "block",
                "type": "paragraph", // 段落として子ブロックを追加
                "paragraph": {
                  "rich_text": [
                    {
                      "text": {
                        "content": tabContent, // tabContent全体をそのまま追加
                      },
                    },
                  ],
                },
              },
            ],
          },
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
