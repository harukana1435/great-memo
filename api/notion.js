import { Client } from "@notionhq/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { markdownToBlocks } from "@tryfabric/martian";

// Notionクライアントの初期化
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function parseTabs(input) {
  // 正規表現で各セクションを抽出
  const titleMatch = input.match(/<Title>(.*?)<\/Title>/s);
  const contentMatch = input.match(/<Content>(.*?)<\/Content>/s);
  const quizMatch = input.match(/<Quiz>(.*?)/s);

  // 各セクションをオブジェクトに格納
  const result = {
    tabTitle: titleMatch ? titleMatch[1].trim() : null,
    tabContent: contentMatch ? contentMatch[1].trim() : null,
    tabQuiz: quizMatch ? quizMatch[1].trim() : null,
  };

  return result;
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      // リクエストボディをパース
      const { tabId, tabContent } = req.body;
      const databaseId = process.env.NOTION_DATABASE_ID;

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const prompt = `
入力文で示される文章をNotionのMarkdown記法で出力してください。
文章の内容を誤字や表現を修正し、必要に応じてわかりやすくしても構いません。

出力する際の形式:
<Title>この中に、20文字程度でタイトルをつけてください。</Title>
<Content>この中に、入力文をマークダウン記法に変換してください。webサイトのURLとタイトルが書いてあればそれも含めてください。</Content>
<Quiz>この中に、入力の内容に基づいた簡単なクイズを複数問作成してください。</Quiz>

入力文:
${tabContent}
      `;

      const result = await model.generateContentStream(prompt);

      let result_text = "";

      for await (const chunk of result.stream) {
        result_text += chunk.text();
      }

      const results = parseTabs(result_text);
      console.log(results);
      const blocks = markdownToBlocks(results.tabContent + results.tabQuiz);
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
                "text": { "content": results.tabTitle, "link": null },
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
