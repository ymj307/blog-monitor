const nodemailer = require("nodemailer");
const cheerio = require("cheerio");

// ============================
// 설정값
// ============================
const CONFIG = {
  blogUrl: "https://daoukiwoom.ai",
  alertEmail: "dymj307@daou.co.kr",
  smtpUser: process.env.GMAIL_USER,
  smtpPass: process.env.GMAIL_PASS,
  requestTimeout: 15000,
};

// ============================
// fetch 헬퍼 (타임아웃 포함)
// ============================
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.requestTimeout);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BlogMonitor/1.0)",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        ...options.headers,
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ============================
// 이메일 발송
// ============================
async function sendAlert(subject, body) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: CONFIG.smtpUser,
      pass: CONFIG.smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"Blog Monitor 🤖" <${CONFIG.smtpUser}>`,
    to: CONFIG.alertEmail,
    subject,
    html: body,
  });

  console.log(`📧 알림 이메일 발송 완료 → ${CONFIG.alertEmail}`);
}

// ============================
// sitemap.xml에서 페이지 URL 수집
// ============================
async function collectPages() {
  const sitemapUrl = `${CONFIG.blogUrl}/sitemap.xml`;
  console.log(`\n🔍 사이트맵 조회 중: ${sitemapUrl}`);

  try {
    const res = await fetchWithTimeout(sitemapUrl);
    const text = await res.text();
    const $ = cheerio.load(text, { xmlMode: true });
    const urls = [];

    $("url > loc").each((_, el) => {
      urls.push($(el).text().trim());
    });

    if (urls.length === 0) {
      console.log("⚠️  sitemap에서 URL을 찾지 못했습니다. 메인 페이지만 체크합니다.");
      return [CONFIG.blogUrl];
    }

    console.log(`✅ 총 ${urls.length}개 페이지 발견`);
    return urls;
  } catch (err) {
    console.log(`⚠️  sitemap 조회 실패: ${err.message}`);
    console.log("메인 페이지만 체크합니다.");
    return [CONFIG.blogUrl];
  }
}

// ============================
// 개별 페이지 방문 및 오류 감지
// ============================
async function visitPage(url) {
  try {
    const res = await fetchWithTimeout(url);
    const html = (await res.text()).toLowerCase();

    const errorKeywords = [
      "not published",
      "isn't published",
      "not connected",
      "page not found",
      "this page is not available",
      "notion page not found",
    ];

    const foundError = errorKeywords.find((kw) => html.includes(kw));

    if (res.status !== 200 || foundError) {
      return {
        url,
        ok: false,
        status: res.status,
        reason: foundError
          ? `오류 문구 감지: "${foundError}"`
          : `HTTP ${res.status}`,
      };
    }

    return { url, ok: true, status: res.status };
  } catch (err) {
    return {
      url,
      ok: false,
      status: 0,
      reason: err.message,
    };
  }
}

// ============================
// 메인 실행
// ============================
async function run() {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  console.log(`\n${"=".repeat(55)}`);
  console.log(`🚀 블로그 모니터링 시작`);
  console.log(`📅 ${now}`);
  console.log(`🌐 ${CONFIG.blogUrl}`);
  console.log(`${"=".repeat(55)}`);

  const pages = await collectPages();
  const errors = [];

  for (const url of pages) {
    process.stdout.write(`  → ${url} ... `);
    const result = await visitPage(url);

    if (result.ok) {
      console.log(`✅ 정상 (${result.status})`);
    } else {
      console.log(`❌ 오류! (${result.reason})`);
      errors.push(result);
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n${"=".repeat(55)}`);
  console.log(`📊 결과: 총 ${pages.length}페이지 중 ${errors.length}개 오류`);
  console.log(`${"=".repeat(55)}`);

  if (errors.length > 0) {
    const errorRows = errors
      .map(
        (e) => `
        <tr>
          <td style="padding:10px;border:1px solid #e2e8f0;word-break:break-all;font-size:14px">
            <a href="${e.url}" style="color:#3182ce">${e.url}</a>
          </td>
          <td style="padding:10px;border:1px solid #e2e8f0;color:#e53e3e;font-size:14px">
            ${e.reason}
          </td>
        </tr>`
      )
      .join("");

    const emailBody = `
      <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
        <div style="background:#e53e3e;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0">⚠️ 블로그 페이지 오류 감지</h2>
        </div>
        <div style="background:#fff8f8;padding:20px;border:1px solid #fed7d7;border-top:none;border-radius:0 0 8px 8px">
          <p style="margin:0 0 8px 0">점검 시각: <strong>${now}</strong></p>
          <p style="margin:0 0 20px 0">
            총 <strong>${pages.length}개</strong> 페이지 중
            <strong style="color:#e53e3e">${errors.length}개</strong>에서 오류가 감지되었습니다.
          </p>
          <table style="border-collapse:collapse;width:100%">
            <thead>
              <tr style="background:#fed7d7">
                <th style="padding:10px;border:1px solid #e2e8f0;text-align:left">페이지 URL</th>
                <th style="padding:10px;border:1px solid #e2e8f0;text-align:left">오류 내용</th>
              </tr>
            </thead>
            <tbody>${errorRows}</tbody>
          </table>
          <div style="margin-top:24px;padding:16px;background:#ebf8ff;border-radius:6px;border-left:4px solid #3182ce">
            <strong>👉 조치 방법</strong><br/>
            Super 대시보드 → 해당 페이지 → <strong>Refresh 버튼</strong> 클릭
          </div>
          <p style="margin-top:20px;color:#a0aec0;font-size:12px">
            이 메일은 Blog Monitor가 자동 발송했습니다. (${CONFIG.blogUrl})
          </p>
        </div>
      </div>
    `;

    await sendAlert(
      `[블로그 알림] ⚠️ ${errors.length}개 페이지 오류 감지 — ${now}`,
      emailBody
    );
  } else {
    console.log("✅ 모든 페이지 정상입니다. 이메일 발송 없음.");
  }
}

run().catch((err) => {
  console.error("❌ 모니터링 실행 중 오류:", err);
  process.exit(1);
});
