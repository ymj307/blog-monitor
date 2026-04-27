const nodemailer = require("nodemailer");
const https = require("https");
const http = require("http");

// ============================
// 설정값
// ============================
// ⚠️ alertEmail의 "" 안에 오류 알람을 받을 이메일 계정을 입력하세요.
const CONFIG = {
  blogUrl: "https://daoukiwoom.ai",
  alertEmail: "",
  smtpUser: process.env.GMAIL_USER,
  smtpPass: process.env.GMAIL_PASS,
  requestTimeout: 15000,
};

// 구버전 페이지 무시목록
const IGNORE_URLS = [
  "https://daoukiwoom.ai/daoustory/password-test",
  "https://daoukiwoom.ai/daoustory/%ec%8a%a4%ed%86%a0%eb%a6%ac",
  "https://daoukiwoom.ai/daoustory/%ec%9d%b8%ec%82%ac%ec%9d%b4%ed%8a%b8",
];

// ============================
// HTTP 요청 헬퍼 (리다이렉트 따라가지 않음)
// ============================
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BlogMonitor/1.0)",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: data, headers: res.headers })
        );
      }
    );

    req.setTimeout(CONFIG.requestTimeout, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.on("error", reject);
  });
}

// ============================
// sitemap.xml에서 URL 수집
// ============================
async function collectPages() {
  const sitemapUrl = `${CONFIG.blogUrl}/sitemap.xml`;
  console.log(`\n🔍 사이트맵 조회 중: ${sitemapUrl}`);

  try {
    // sitemap은 리다이렉트 따라가도 됨
    let res = await httpGet(sitemapUrl);
    if ((res.status === 301 || res.status === 302) && res.headers.location) {
      res = await httpGet(res.headers.location);
    }

    const matches = res.body.match(/<loc>(.*?)<\/loc>/g) || [];
    let urls = matches.map((m) => m.replace(/<\/?loc>/g, "").trim());

    if (urls.length === 0) {
      console.log("⚠️  sitemap에서 URL을 찾지 못했습니다. 메인 페이지만 체크합니다.");
      return [CONFIG.blogUrl];
    }
    // 무시할 URL 필터링
    const before = urls.length;
    urls = urls.filter((url) => !IGNORE_URLS.includes(url));
    const ignored = before - urls.length;

    console.log(`✅ 총 ${urls.length}개 페이지 발견 (${ignored}개 무시)`);

    // 테스트 url
    // urls.push("https://daoukiwoom.ai/test-404-page");

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
    const { status, body } = await httpGet(url);
    const html = body.toLowerCase();

    // 301/302 리다이렉트 감지
    if (status === 301 || status === 302) {
      return {
        url,
        ok: false,
        status,
        reason: `리다이렉트 감지 (HTTP ${status})`,
      };
    }

    // 404, 5xx 등 HTTP 오류 감지
    if (status === 404 || status >= 500) {
      return {
        url,
        ok: false,
        status,
        reason: `HTTP ${status} 오류`,
      };
    }

    // Super/Notion 특유의 오류 문구 감지 (캡처 기준)
    const errorKeywords = [
      "this page doesn't seem to exist",   // Super 오류 화면 1
      "this page doesn't exist",            // Super 404 화면
      "error 404: page not found",          // Super 404 태그
      "the page still isn't fixed",         // Super 오류 안내
      "not published",                       // Notion 미발행
      "isn't published",
      "not connected",
      "notion page not found",
    ];

    const foundError = errorKeywords.find((kw) => html.includes(kw));
    if (foundError) {
      return {
        url,
        ok: false,
        status,
        reason: `오류 문구 감지: "${foundError}"`,
      };
    }

    return { url, ok: true, status };
  } catch (err) {
    return { url, ok: false, status: 0, reason: err.message };
  }
}

// ============================
// 이메일 발송
// ============================
async function sendAlert(subject, body) {

  if (!CONFIG.smtpUser || !CONFIG.smtpPass) {
    console.log("⚠️  GMAIL_USER 또는 GMAIL_PASS가 설정되지 않아 이메일 발송을 건너뜁니다.");
    console.log("   GitHub Secrets에 GMAIL_USER와 GMAIL_PASS를 등록해주세요.");
    return;
  }

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
