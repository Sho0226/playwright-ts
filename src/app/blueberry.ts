import { chromium } from "playwright";
import * as dotenv from "dotenv";

// .envファイルを読み込む
dotenv.config();

// --- 設定項目 ---
const TARGET_URLS = [
  "https://reserve.peraichi.com/r/2431beb2/select_date?base_date=2025-07-07&course=4066",
  "https://reserve.peraichi.com/r/2431beb2/select_date?base_date=2025-08-07&course=4066",
];

const SELECTORS = {
  unavailable: ".c-mark.c-mark--blank.c-mark--xs.text-custom-muted-text", // 予約不可
  full: ".c-mark.c-mark--ng.c-mark--xs.text-custom-muted-text", // 空きなし
  little: ".c-mark.c-mark--warning.c-mark--xs.text-custom-muted-text", // 少し空きあり
  available: ".c-mark.c-mark--ok.c-mark--xs.text-custom-muted-text", // 予約可能
};

// Webhook URLを環境変数から取得
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

interface Stats {
  month: string;
  unavailable: number;
  full: number;
  little: number;
  available: number;
}

/**
 * Discordにメッセージを送信
 */
async function sendDiscordNotification(
  message: string,
  isAlert: boolean = false
) {
  if (!WEBHOOK_URL) {
    console.log(
      "WEBHOOK_URL が設定されていないため、Discord通知をスキップします"
    );
    return;
  }

  try {
    // Discord Embed形式で見やすく整形
    const embed = {
      title: isAlert ? "🚨 予約監視エラー" : "🔍 予約状況チェック",
      description: message,
      color: isAlert ? 0xff0000 : 0x00ff00, // 赤色 or 緑色
      timestamp: new Date().toISOString(),
      footer: {
        text: "予約監視Bot by GitHub Actions",
      },
    };

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "予約監視Bot",
        avatar_url: "https://cdn.discordapp.com/emojis/🤖.png",
        embeds: [embed],
      }),
    });

    if (response.ok) {
      console.log("✅ Discord通知を送信しました");
    } else {
      console.error("❌ Discord通知の送信に失敗:", response.status);
    }
  } catch (error) {
    console.error("❌ Discord通知送信エラー:", error);
  }
}

/**
 * 予約枠発見時の緊急通知（別チャンネル用）
 */
async function sendAvailabilityAlert(stats: Stats[]) {
  if (!ALERT_WEBHOOK_URL) {
    console.log(
      "ALERT_WEBHOOK_URL が設定されていないため、緊急通知をスキップします"
    );
    return;
  }

  const availableSlots = stats.filter(
    (stat) => stat.available + stat.little > 0
  );
  if (availableSlots.length === 0) return;

  const timestamp = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  let alertMessage = `🚨 **【緊急】予約枠が空きました！** 🚨\n🕐 ${timestamp}\n\n`;

  availableSlots.forEach((stat) => {
    alertMessage += `🎯 **${stat.month}**: ${
      stat.available + stat.little
    }個の予約可能枠あり！\n`;
  });

  const totalAvailable = availableSlots.reduce(
    (sum, stat) => sum + stat.available + stat.little,
    0
  );
  alertMessage += `\n💥 **合計 ${totalAvailable}個の枠が予約可能です！**\n`;
  alertMessage += `⚡ **今すぐ予約サイトをチェックしてください！**`;

  try {
    const embed = {
      title: "🚨 予約枠発見アラート！",
      description: alertMessage,
      color: 0xffa500, // オレンジ色
      timestamp: new Date().toISOString(),
      footer: {
        text: "緊急通知 by 予約監視Bot",
      },
    };

    const response = await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "🚨予約アラートBot🚨",
        avatar_url: "https://cdn.discordapp.com/emojis/🚨.png",
        embeds: [embed],
        content: "@everyone", // メンション通知
      }),
    });

    if (response.ok) {
      console.log("🚨 緊急アラート通知を送信しました");
    } else {
      console.error("❌ 緊急アラート通知の送信に失敗:", response.status);
    }
  } catch (error) {
    console.error("❌ 緊急アラート通知送信エラー:", error);
  }
}

/**
 * Discord用に統計情報を整形
 */
function formatDiscordStats(stats: Stats[]): string {
  const timestamp = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  let message = `**📊 予約状況レポート**\n🕐 ${timestamp}\n\n`;

  stats.forEach((stat, index) => {
    message += `**${stat.month}**\n`;
    message += `${stat.unavailable > 0 ? "⚪️" : "⚫"} 予約不可: \`${
      stat.unavailable
    }\`個\n`;
    message += `${stat.little > 0 ? "⚠️" : "⚫"} 少し空きあり: \`${
      stat.little
    }\`個\n`;
    message += `${stat.full > 0 ? "❌" : "⚫"} 空きなし: \`${stat.full}\`個\n`;
    message += `${stat.available > 0 ? "✅" : "⚫"} **予約可: \`${
      stat.available
    }\`個**\n`;

    if (index < stats.length - 1) message += "\n";
  });

  // 合計と結果サマリー
  const totalAvailable = stats.reduce(
    (sum, stat) => sum + stat.available + stat.little,
    0
  );
  const totalSlots = stats.reduce(
    (sum, stat) =>
      sum + stat.unavailable + stat.full + stat.available + stat.little,
    0
  );

  message += `\n**📈 サマリー**\n`;
  message += `🎯 合計予約可能: **${totalAvailable}個**\n`;
  message += `📊 総スロット数: ${totalSlots}個\n`;

  if (totalAvailable > 0) {
    message += `\n🎉 **${totalAvailable}個の予約可能枠を発見！**`;
  } else {
    message += `\n😔 現在予約可能な枠はありません`;
  }

  return message;
}

/**
 * メイン処理：予約状況を監視
 */
async function monitorReservations() {
  console.log("🚀 予約監視を開始します...");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const stats: Stats[] = [];

  try {
    for (const url of TARGET_URLS) {
      console.log(`📄 ページを確認中: ${url}`);

      await page.goto(url, { waitUntil: "domcontentloaded" });

      // 月の表示を取得
      const monthText =
        (await page.locator(".h3.mb-0").textContent()) || "不明";

      // 各アイコンの数を取得
      const [unavailableCount, fullCount, littleCount, availableCount] =
        await Promise.all([
          page.locator(SELECTORS.unavailable).count(),
          page.locator(SELECTORS.full).count(),
          page.locator(SELECTORS.little).count(),
          page.locator(SELECTORS.available).count(),
        ]);

      const stat: Stats = {
        month: monthText,
        unavailable: unavailableCount,
        full: fullCount,
        little: littleCount,
        available: availableCount,
      };

      stats.push(stat);

      // コンソールにも表示
      console.log(`\n--- [${monthText}] の統計結果 ---`);
      console.log(`⚪️ 予約不可: ${unavailableCount} 個`);
      console.log(`❌ 空きなし: ${fullCount} 個`);
      console.log(`⚠️ 少し空きあり: ${littleCount} 個`);
      console.log(`✅ 予約可: ${availableCount} 個`);
      console.log("---------------------------------");
    }

    // Discord通知を送信
    const message = formatDiscordStats(stats);
    await sendDiscordNotification(message);

    // 予約枠が空いていれば緊急通知も送信
    await sendAvailabilityAlert(stats);
  } catch (error) {
    console.error("❌ 監視処理中にエラーが発生:", error);

    // エラーもDiscordに通知
    const errorMessage = `予約監視処理でエラーが発生しました\n\n**エラー詳細:**\n\`\`\`\n${error}\n\`\`\``;
    await sendDiscordNotification(errorMessage, true);
  } finally {
    await browser.close();
    console.log("✨ 監視処理が完了しました");
  }
}

// GitHub Actions環境での実行
if (require.main === module) {
  monitorReservations();
}
