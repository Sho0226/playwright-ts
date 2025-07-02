import * as dotenv from "dotenv";

// .envファイルを読み込む
dotenv.config();

// テスト用のダミーデータ
const testStats = [
  {
    month: "2025年7月",
    unavailable: 15,
    full: 13,
    available: 2, // 予約可能枠をシミュレート
  },
  {
    month: "2025年8月",
    unavailable: 23,
    full: 8,
    available: 0,
  },
];

interface Stats {
  month: string;
  unavailable: number;
  full: number;
  available: number;
}

/**
 * 予約枠発見時の緊急通知（別チャンネル用）
 */
async function sendAvailabilityAlert(stats: Stats[]) {
  const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

  if (!ALERT_WEBHOOK_URL) {
    console.log(
      "ALERT_WEBHOOK_URL が設定されていないため、緊急通知をスキップします"
    );
    return;
  }

  const availableSlots = stats.filter((stat) => stat.available > 0);
  if (availableSlots.length === 0) {
    console.log("予約可能枠がないため、緊急通知をスキップします");
    return;
  }

  const timestamp = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  let alertMessage = `🚨 **【緊急】予約枠が空きました！** 🚨\n🕐 ${timestamp}\n\n`;

  availableSlots.forEach((stat) => {
    alertMessage += `🎯 **${stat.month}**: ${stat.available}個の予約可能枠あり！\n`;
  });

  const totalAvailable = availableSlots.reduce(
    (sum, stat) => sum + stat.available,
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

async function testAlert() {
  console.log("🧪 緊急アラート通知テスト開始...");
  await sendAvailabilityAlert(testStats);
  console.log("✨ テスト完了");
}

testAlert();
