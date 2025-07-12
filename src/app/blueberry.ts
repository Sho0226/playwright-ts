import { chromium, Page } from "playwright";
import * as dotenv from "dotenv";

// .envファイルを読み込む
dotenv.config();

// --- 設定項目 ---
const TARGET_URLS = [
  "https://reserve.peraichi.com/r/2431beb2/select_date?base_date=2025-07-07&course=4066",
  "https://reserve.peraichi.com/r/2431beb2/select_date?base_date=2025-08-07&course=4066",
];

const SELECTORS = {
  unavailable: '.inner i[title="予約不可"]',
  full: '.inner i[title="空きなし"]',
  little: '.inner span[title="残りわずか"]',
  available: '.inner span[title="予約可能"]',
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
        embeds: [embed],
      }),
    });

    if (response.ok) {
      console.log("✅ Discord通知を送信しました");
    } else {
      console.error("❌ Discord通知の送信に失敗:", response.status);
      const errorText = await response.text();
      console.error("エラー詳細:", errorText);
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

  // デバッグ用：アラート条件の確認
  console.log("🔍 アラート条件チェック:");
  stats.forEach((stat) => {
    console.log(
      `  ${stat.month}: 予約可=${stat.available}, 残りわずか=${
        stat.little
      }, 合計=${stat.available + stat.little}`
    );
  });
  console.log(`📊 アラート対象スロット数: ${availableSlots.length}`);

  if (availableSlots.length === 0) {
    console.log("❌ 予約可能枠がないため、アラートをスキップします");
    return;
  }

  const timestamp = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  let alertMessage = `🚨 **【緊急】予約枠が空きました！** 🚨\n🕐 ${timestamp}\n\n`;

  availableSlots.forEach((stat) => {
    const details = [];
    if (stat.available > 0) details.push(`予約可:${stat.available}個`);
    if (stat.little > 0) details.push(`残りわずか:${stat.little}個`);

    alertMessage += `🎯 **${stat.month}**: ${details.join(", ")} (計${
      stat.available + stat.little
    }個)\n`;
  });

  const totalAvailable = availableSlots.reduce(
    (sum, stat) => sum + stat.available + stat.little,
    0
  );
  alertMessage += `\n💥 **合計 ${totalAvailable}個の枠が予約可能です！**\n`;
  alertMessage += `⚡ **今すぐ予約サイトをチェックしてください！**`;
  alertMessage += `\n\n🔗 [予約サイトはこちら](${TARGET_URLS[0]})`;

  console.log("🚨 アラート送信開始:", alertMessage);

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
        embeds: [embed],
        content: "@everyone", // メンション通知
      }),
    });

    if (response.ok) {
      console.log("✅ 緊急アラート通知を送信しました");
    } else {
      console.error("❌ 緊急アラート通知の送信に失敗:", response.status);
      const errorText = await response.text();
      console.error("エラー詳細:", errorText);
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
 * エラーオブジェクトを安全に文字列に変換
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack || ""}`;
  }
  return String(error);
}

/**
 * デバッグ用：セレクターの動作確認
 */
async function debugSelectors(page: Page) {
  console.log("🔍 セレクターデバッグ開始...");

  // 全てのc-markクラスを持つ要素を検索
  const allMarks = await page.locator(".c-mark").all();
  console.log(`📊 総c-mark要素数: ${allMarks.length}`);

  // 各要素のクラス名を確認
  for (let i = 0; i < Math.min(allMarks.length, 10); i++) {
    const className = await allMarks[i].getAttribute("class");
    const text = await allMarks[i].textContent();
    console.log(`  要素${i}: class="${className}", text="${text}"`);
  }

  // 各セレクターの要素数を確認
  for (const [key, selector] of Object.entries(SELECTORS)) {
    const count = await page.locator(selector).count();
    console.log(`📌 ${key} (${selector}): ${count}個`);
  }
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

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      // デバッグ用：セレクターの動作確認
      await debugSelectors(page);

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

      // 個別でもアラートチェック
      if (littleCount > 0 || availableCount > 0) {
        console.log(
          `🚨 [${monthText}] で予約枠を発見！ 予約可:${availableCount}, 残りわずか:${littleCount}`
        );
      }
    }

    // Discord通知を送信
    const message = formatDiscordStats(stats);
    await sendDiscordNotification(message);

    // 予約枠が空いていれば緊急通知も送信
    console.log("🔍 アラート送信前の最終チェック...");
    await sendAvailabilityAlert(stats);
  } catch (error) {
    console.error("❌ 監視処理中にエラーが発生:", error);

    // エラーもDiscordに通知（型安全に変換）
    const errorMessage = `予約監視処理でエラーが発生しました\n\n**エラー詳細:**\n\`\`\`\n${formatError(
      error
    )}\n\`\`\``;
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
