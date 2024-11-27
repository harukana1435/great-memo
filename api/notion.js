import { Client } from "@notionhq/client";

// Notionクライアントの初期化
const notion = new Client({ auth: process.env.NOTION_API_KEY });

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      // リクエストボディをパース
      const { tabId, tabContent } = req.body;
      const databaseId = process.env.NOTION_DATABASE_ID;

      // データベース内のページを検索
      const searchResponse = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: "ID", // データベースのプロパティ名
          text: {
            equals: tabId,
          },
        },
      });

      if (searchResponse.results.length > 0) {
        // 同じIDのページが見つかった場合、そのページを更新
        const pageId = searchResponse.results[0].id;

        await notion.pages.update({
          page_id: pageId,
          properties: {
            Content: {
              rich_text: [
                {
                  text: {
                    content: tabContent,
                  },
                },
              ],
            },
          },
        });

        res.status(200).json({ message: "Page updated successfully" });
      } else {
        // 同じIDのページが見つからない場合、新しいページを作成
        await notion.pages.create({
          parent: { database_id: databaseId },
          properties: {
            ID: {
              rich_text: [
                {
                  text: {
                    content: tabId,
                  },
                },
              ],
            },
            Content: {
              rich_text: [
                {
                  text: {
                    content: tabContent,
                  },
                },
              ],
            },
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
