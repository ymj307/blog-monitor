# 블로그 모니터 (daoukiwoom.ai)

daoukiwoom.ai의 모든 페이지를 3시간마다 자동 순회하여 오류를 감지하고 이메일로 알림을 보내는 자동화 스크립트입니다.

## 동작 방식

1. `sitemap.xml`을 읽어 전체 페이지 URL 자동 수집
2. 각 페이지를 방문하여 캐시 갱신 트리거
3. 오류 문구 또는 HTTP 오류 감지 시 이메일 발송
4. 새 페이지가 추가되면 자동으로 포함됨 (별도 설정 불필요)

## GitHub 초기 설정

### 1. 레포지토리 생성
GitHub에서 새 레포지토리 생성 후 이 코드를 업로드합니다.

### 2. GitHub Secrets 설정
레포지토리 → Settings → Secrets and variables → Actions → New repository secret

| Secret 이름 | 값 |
|------------|-----|
| `GMAIL_USER` | dymj307@gmail.com |
| `GMAIL_PASS` | Gmail 앱 비밀번호 16자리 |

### 3. Actions 활성화
레포지토리 → Actions 탭 → "I understand my workflows" 클릭

### 4. 수동 테스트
Actions → Blog Monitor → Run workflow 클릭으로 즉시 테스트 가능

## 오류 감지 조건

- HTTP 200이 아닌 응답
- 페이지 내 아래 문구 포함 시:
  - "not published"
  - "isn't published"
  - "not connected"
  - "page not found"
  - "this page is not available"
  - "notion page not found"

## 오류 발생 시 조치

Super 대시보드 → 해당 페이지 → **Refresh 버튼** 클릭
