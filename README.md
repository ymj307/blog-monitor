# 다우키움 AI 허브 블로그 모니터링

## 프로세스 간략 설명

**daoukiwoom.ai** 블로그의 모든 페이지를 **1시간마다 자동으로 확인**해서, 페이지가 오류를 보이거나 접속이 안 될 경우 **담당자 이메일로 알림**을 보내주는 자동화 시스템입니다.

> 노션 + Super 기반 블로그 특성상 가끔 캐시 문제로 특정 페이지가 갑자기 "페이지를 찾을 수 없음" 오류를 띄우는 경우가 있습니다. 이 시스템은 그걸 자동으로 감지해서 알려주기 위해 제작되었습니다.

---

## 어떻게 작동하나요?

```
1시간마다 자동 실행
       ↓
블로그 전체 페이지 목록 가져오기 (sitemap.xml 순회)
       ↓
각 페이지 하나씩 접속해서 확인
       ↓
오류 감지되면 → 이메일 알림 발송
오류 없으면  → 아무것도 안 함
```

새 블로그 글이 올라가도 **자동으로 포함**되어 모니터링됩니다. 별도 설정 필요 없습니다.

---

## 오류로 판단하는 경우

아래 중 하나라도 해당되면 이메일 알림이 발송됩니다.

- 페이지 접속 시 **404 오류** (페이지를 찾을 수 없음)
- 페이지 접속 시 **500 오류** (서버 오류)
- 페이지에 **"This page doesn't seem to exist"** 문구가 보일 때
- 페이지에 **"not published"** 등 노션 미발행 문구가 보일 때

---

## 오류 이메일을 받았을 때 조치 방법

1. **super.so** 접속 후 로그인(ax팀 지메일 계정)
2. 해당 사이트(daoukiwoom.ai) 대시보드 진입
3. 오류가 난 페이지 찾기
4. **Refresh 버튼** 클릭
5. daoukiwoom.ai 접속 -> shift+r 강제 새로고침 이후, 해당 페이지 정상 확인


---

## 처음 설정하는 방법 (인수인계 시)

### 준비물
- GitHub 계정
- Gmail 계정 (알림받을 이메일 계정, ax팀 지메일 계정 권고고)

---

### 1단계 - Gmail 앱 비밀번호 발급

> 일반 Gmail 비밀번호와 다른, 이 자동화 전용 비밀번호입니다. 보안을 위해 별도로 발급합니다.

1. 계정관리 -> 검색창에 "앱 비밀번호" 입력 후 클릭 -> 본인 인증 진행
   - ※ Gmail 2단계 인증이 켜져 있어야 합니다
2. 앱 이름 입력란에 `BlogMonitor` 입력
3. **만들기** 클릭
4. 16자리 비밀번호 발급됨 → **반드시 복사해두기**
  - ※ 창을 닫으면 비밀번호는 다시 확인할 수 없습니다.

---

### 2단계 - GitHub에 코드 올리기

1. [github.com](https://github.com) 로그인
2. 우상단 **+** → **New repository**
3. Repository name: `blog-monitor`
4. **Public** 선택 → **Create repository**
5. 레포지토리 메인 화면에서 **uploading an existing file** 클릭
6. 이 폴더의 파일 전체를 드래그 앤 드롭
7. 단, `.github` 폴더는 웹 업로드가 안 되므로 GitHub Desktop 또는 Git으로 업로드 필요
   (Git 설치 방법: git-scm.com 접속 → Download → 기본값으로 설치)
   
---

### 3단계 - Gmail 정보 등록 (GitHub Secrets)

> 코드가 Public이어도 여기 등록한 정보는 외부에서 확인할 수 없어 안전이 보장됩니다.

1. 레포지토리 페이지에서 **Settings** 탭 클릭
2. 왼쪽 메뉴 **Secrets and variables** → **Actions** 클릭
3. **New repository secret** 버튼으로 아래 두 가지 등록

| 이름 | 값 |
|------|-----|
| `GMAIL_USER` | 발신용 Gmail 주소 (ax팀 지메일 계정 권고) |
| `GMAIL_PASS` | 1단계에서 발급받은 16자리 앱 비밀번호 |

---

### 4단계 - 자동화 활성화

1. 레포지토리 페이지에서 **Actions** 탭 클릭
2. 활성화 버튼이 보이면 클릭

---

### 5단계 - 정상 작동 테스트

1. Actions 탭 → **Blog Monitor** → **Run workflow** 클릭
2. 실행 완료 후 초록색 체크(✅)가 뜨면 정상
3. 오류 감지 테스트를 원하면 아래 **테스트 방법** 참고

---

## 유지보수

### 알림 받을 이메일 주소 변경
`monitor.js` 파일 상단의 아래 부분 수정

```javascript
const CONFIG = {
  alertEmail: "변경할이메일@daou.co.kr",  // ← 여기 수정
```

---

### 모니터링에서 제외할 페이지 추가
sitemap에는 남아있지만 실제로는 없는 구버전 페이지 등을 무시할 때 사용합니다.
`monitor.js` 파일 상단의 아래 부분에 URL 추가

```javascript
const IGNORE_URLS = [
  "https://daoukiwoom.ai/구버전-페이지-url",  // ← 이런 형식으로 추가
];
```

---

### 모니터링 주기 변경
`.github/workflows/monitor.yml` 파일에서 아래 부분 수정

```yaml
# 현재 설정: 1시간마다
- cron: "0 * * * *"

# 30분마다로 변경하고 싶다면
- cron: "*/30 * * * *"
```

---

## 오류 감지 테스트 방법

실제로 이메일 알림이 오는지 확인하고 싶을 때 사용합니다.

1. `monitor.js` 파일에서 `collectPages()` 함수 안 `return urls` 바로 위에 아래 한 줄 추가

```javascript
urls.push("https://daoukiwoom.ai/test-404-page");
return urls;
```

2. 저장 후 GitHub에 업로드
3. Actions → **Run workflow** 실행
4. 이메일 수신 확인
5. 확인 완료 후 추가했던 줄 삭제 → 다시 업로드

---

## 파일 구조 설명

```
blog-monitor/
├── monitor.js                    ← 핵심 모니터링 코드
├── package.json                  ← 필요한 라이브러리 목록
├── README.md                     ← 이 문서
└── .github/
    └── workflows/
        └── monitor.yml           ← 자동 실행 스케줄 설정
```