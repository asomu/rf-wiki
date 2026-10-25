# Cloudflare Pages 배포 가이드

RF Wiki는 정적 Astro 빌드이므로 Cloudflare Pages 무료 플랜의 Git 연동으로 배포한다. `main`에 push하면 Cloudflare가 저장소를 받아 빌드하고 공개본을 교체한다. 서버 코드, Worker 함수, 데이터베이스는 사용하지 않는다.

이전 공개 위치였던 OpenAI Sites(`build:sites`, `worker/`, `.openai/hosting.json`)는 ChatGPT/Codex 계정이 있어야 새 version을 올릴 수 있어 더 이상 기본 배포 경로가 아니다. 해당 파일은 기존 공개본 기록을 위해 그대로 둔다.

## 저장소 쪽 준비 (완료)

| 파일 | 역할 |
|---|---|
| `scripts/build-cloudflare.mjs` | `PUBLIC_SITE_URL`이 https 공개 주소인지 확인 → `npm run build` → `dist/`에 `index.html`, `404.html`, `_headers`, Pagefind가 있는지와 localhost 주소가 없는지 검사 |
| `npm run build:cloudflare` | 위 스크립트 실행. Cloudflare의 build command |
| `.node-version` | Cloudflare 빌드 이미지가 사용할 Node 버전 (`22.12.0`, `package.json` engines와 동일) |
| `src/pages/404.astro` | `dist/404.html`. 이 파일이 없으면 Cloudflare Pages가 SPA로 판단해 없는 경로에도 홈을 200으로 돌려준다 |
| `public/_headers` | 해시가 붙은 `/_astro/*` 파일을 1년 immutable 캐시 |
| `tests/hosting/cloudflare-build.test.mjs` | `PUBLIC_SITE_URL` 검증 규칙 테스트 (`npm run test:hosting`에 포함) |

## 최초 설정 (사용자가 직접)

계정 생성과 로그인, GitHub 권한 승인은 본인이 직접 한다.

1. `https://dash.cloudflare.com/sign-up`에서 가입하고 이메일 인증을 마친다. 카드 등록은 필요 없다.
2. 대시보드 → **Workers & Pages** → **Create** → **Pages** 탭 → **Connect to Git**.
3. GitHub 계정을 연결하고, 접근 권한은 **Only select repositories**에서 `asomu/rf-wiki`만 허용한다.
4. 저장소 `rf-wiki`를 선택하고 아래처럼 설정한다.

   | 항목 | 값 |
   |---|---|
   | Project name | `rf-wiki` (공개 주소가 `https://rf-wiki.pages.dev`가 된다. 이미 쓰인 이름이면 다른 이름을 정하고 아래 URL도 맞춘다) |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `npm run build:cloudflare` |
   | Build output directory | `dist` |
   | Root directory | 비워 둠 |

5. **Environment variables**에 추가한다.

   | 이름 | 값 |
   |---|---|
   | `PUBLIC_SITE_URL` | `https://rf-wiki.pages.dev` (4번의 project name에 맞춘 주소) |
   | `ASTRO_TELEMETRY_DISABLED` | `1` |

6. **Save and Deploy**. 첫 빌드는 `npm ci`를 포함해 몇 분 걸린다.

`PUBLIC_SITE_URL`이 없거나 http·localhost이면 `build:cloudflare`가 즉시 실패한다. canonical과 `og:image`에 로컬 주소가 섞여 공개되는 것을 막기 위한 의도된 동작이다.

## 배포 후 확인

```bash
B=https://rf-wiki.pages.dev
for p in / /cellular/ /dvt/ /search/ /og.png /pagefind/pagefind.js /no-such-page/; do curl -s -o /dev/null -w "%{http_code} $p\n" "$B$p"; done
```

`/no-such-page/`만 `404`이고 나머지는 `200`이어야 한다. 브라우저에서는 홈, 검색어 입력, 계측기 Python 예제 ZIP 다운로드, GSM PvT lab을 한 번씩 열어 본다.

## 이후 배포

- `main`에 push하면 production 배포가 자동으로 돌아간다.
- 다른 브랜치나 PR은 `https://<hash>.rf-wiki.pages.dev` preview 주소로 따로 배포된다. preview 빌드에도 같은 `PUBLIC_SITE_URL`을 쓰므로 canonical은 항상 production 주소를 가리킨다.
- 로컬에서 같은 빌드를 재현하려면:

  ```bash
  PUBLIC_SITE_URL=https://rf-wiki.pages.dev npm run build:cloudflare
  ```

## 무료 플랜 한도 (2026-10 기준, 변경될 수 있음)

- 정적 파일 요청·대역폭 제한 없음
- 월 500회 빌드, 동시 빌드 1개
- 사이트당 파일 20,000개, 파일당 25 MiB

현재 빌드는 파일 약 940개, 약 17 MB이고 가장 큰 파일은 `og.png`(약 1.5 MB)라 한도 안에 있다.
