import { Client } from "@notionhq/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { markdownToBlocks } from "@tryfabric/martian";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function splitContentIntoChunks(content, chunkSize = 300) {
  const chunks = [];
  let currentChunk = "";

  for (const sentence of content.split(/(?<=[。．！？\n])/)) {
    // 文末句読点で分割
    if ((currentChunk + sentence).length > chunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += sentence;
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function extractUrlsAndTitles(content) {
  const urlRegex = /(https?:\/\/[^\s]+)/g; // URLを抽出する正規表現
  const lines = content.split("\n"); // 改行で文章を分割
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(urlRegex);
    if (match) {
      const url = match[0];
      const title = i > 0 ? lines[i - 1].trim() : "タイトルなし"; // URLの1行前をタイトルとして抽出
      results.push({ url, title });
    }
  }

  return results;
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { tabId, tabContent } = req.body;
      const databaseId = process.env.NOTION_DATABASE_ID;

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // 1. 入力文のタイトルを生成
      const titlePrompt = `以下の文章を簡潔に表すタイトルを20文字以内で生成してください:\n\n${tabContent}`;
      const titleResponse = await model.generateText({ prompt: titlePrompt });
      const tabTitle = titleResponse.text.trim();

      // 2. 入力文を200字程度で分割し、各区間をMarkdown形式に変換
      const sections = splitContentIntoChunks(tabContent);
      const markdownSections = [];
      for (const section of sections) {
        const sectionPrompt = `以下の文章をMarkdown記法に変換してください:\n\n${section}`;
        const sectionResponse = await model.generateText({
          prompt: sectionPrompt,
        });
        markdownSections.push(sectionResponse.text.trim());
      }

      // 3. 入力文からURLを抽出し、対応するタイトルを生成
      const urls = extractUrlsAndTitles(tabContent);

      // // 4. 入力文の内容に沿ったクイズを生成
      // const quizPrompt = `以下の文章に基づいて役立つクイズを複数問作成してください。\n\n${tabContent}`;
      // const quizResponse = await model.generateText({ prompt: quizPrompt });
      // const tabQuiz = quizResponse.text.trim();

      // MarkdownをNotion用のブロックに変換
      const blocks = markdownToBlocks(
        markdownSections.join("\n\n") +
          "\nーーーーーーーーーーーーーーーーーーーーーーーーーーーー\n" +
          urls
            .map((detail) => `- [${detail.title}](${detail.url})`)
            .join("\n") +
          "\nーーーーーーーーーーーーーーーーーーーーーーーーーーーー\n" +
          "## 原文\n" +
          tabContent,
      );

      // データベース内のページを検索
      const searchResponse = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: "tabID",
          rich_text: {
            equals: tabId,
          },
        },
      });

      if (searchResponse.results.length > 0) {
        // 同じIDのページが見つかった場合、そのページをアーカイブ
        const pageId = searchResponse.results[0].id;
        await notion.pages.update({
          page_id: pageId,
          archived: true,
        });
      }

      // 新しいページを作成
      await notion.pages.create({
        parent: { type: "database_id", database_id: databaseId },
        properties: {
          tabID: {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: { content: tabId },
              },
            ],
          },
          Name: {
            type: "title",
            title: [
              {
                type: "text",
                text: { content: tabTitle },
              },
            ],
          },
        },
        children: blocks,
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
