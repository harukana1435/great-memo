import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export default {
  async fetch(req, env) {
    if (req.method === "POST") {
      try {
        // リクエストボディをパース
        const { tabId, tabContent } = await req.json();
        const databaseId = env.NOTION_DATABASE_ID;

        // Notionクライアントの初期化
        const notion = new env.notionClient({
          auth: env.NOTION_API_KEY,
        });
        console.log(tabID);
        console.log(tabContent);

        // データベース内のページを検索
        const searchResponse = await notion.databases.query({
          database_id: databaseId,
          filter: {
            property: "ID", // データベースのプロパティ名 (事前に設定)
            text: {
              equals: tabId,
            },
          },
        });
        console.log(searchResponse.results);

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

          return new Response(
            JSON.stringify({ message: "Page updated successfully" }),
            { status: 200 }
          );
        } else {
          // 同じIDのページが見つからない場合、新しいページを作成
          await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
              ID: {
                title: [
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

          return new Response(
            JSON.stringify({ message: "Page created successfully" }),
            { status: 200 }
          );
        }
      } catch (error) {
        console.error("Error processing request:", error);
        return new Response(
          JSON.stringify({ error: "Failed to process request" }),
          { status: 500 }
        );
      }
    } else {
      return new Response("Method Not Allowed", { status: 405 });
    }
  },
};
