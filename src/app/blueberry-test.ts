import * as dotenv from "dotenv";

// .envファイルを読み込む
dotenv.config();

async function testDiscord() {
  console.log("🧪 Discord通知テスト開始...");

  try {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("WEBHOOK_URL is not defined in environment variables.");
    }
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "予約監視Bot",
        content: "🧪 テスト通知です！GitHub Actionsの準備ができました！",
      }),
    });

    if (response.ok) {
      console.log("✅ 成功！Discordに通知が送信されました");
    } else {
      console.error("❌ 失敗:", response.status, await response.text());
    }
  } catch (error) {
    console.error("❌ エラー:", error);
  }
}

testDiscord();
