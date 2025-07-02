import { chromium } from "playwright";

// --- 設定項目 ---
// 統計を取りたいページのURLリスト
const TARGET_URLS = [
  "https://reserve.peraichi.com/r/2431beb2/select_date?base_date=2025-07-07&course=4066",
  "https://reserve.peraichi.com/r/2431beb2/select_date?base_date=2025-08-07&course=4066",
];

// --- セレクター定義 ---
const SELECTORS = {
  // `<i>` タグの title 属性で正確に判別します
  unavailable: "i[title='予約不可']",
  full: "i[title='空きなし']",
  available: "i[title='予約可']",
};

/**
 * ページのアイコン統計を取得し、結果を表示する関数
 */
async function logPageStats() {
  console.log("アイコンの統計を開始します...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 指定されたURLを一つずつ処理する
    for (const url of TARGET_URLS) {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      // ページに表示されている年月を取得 (例: 2025年7月)
      const monthText = await page.locator(".h3.mb-0").textContent();

      // 各アイコンの数を並行して取得
      const [unavailableCount, fullCount, availableCount] = await Promise.all([
        page.locator(SELECTORS.unavailable).count(),
        page.locator(SELECTORS.full).count(),
        page.locator(SELECTORS.available).count(),
      ]);

      // 結果を整形して表示
      console.log(`\n--- [${monthText}] の統計結果 ---`);
      console.log(`⚪️ 予約不可: ${unavailableCount} 個`);
      console.log(`❌ 空きなし: ${fullCount} 個`);
      console.log(`✅ 予約可  : ${availableCount} 個`);
      console.log("---------------------------------");
    }
  } catch (error) {
    console.error("統計の取得中にエラーが発生しました:", error);
  } finally {
    await browser.close();
    console.log("\n全てのページの統計が完了しました。");
  }
}

// --- 実行 ---
logPageStats();
