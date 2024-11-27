const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");

// 環境変数を読み込む
dotenv.config();

// Notionクライアントを設定
const notion = new Client({ auth: process.env.NOTION_API_KEY });

module.exports = async (req, res) => {
  if (req.method === "GET") {
    try {
      // Notionデータベースのプロパティを取得
      const response = await notion.databases.retrieve({
        database_id: process.env.NOTION_DATABASE_ID,
      });
      console.log(response);
      // レスポンスを返す
      res.status(200).json(response);
    } catch (error) {
      console.error("Error details:", error);
      console.error(
        "Error response:",
        error.response ? error.response.body : "No response body"
      );
      res
        .status(500)
        .json({ error: "Failed to retrieve Notion database properties" });
    }
  } else {
    res.status(405).json({ error: "Method Not Allowed" });
  }
};
