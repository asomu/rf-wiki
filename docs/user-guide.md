# RF Wiki 사용자 가이드

RF Wiki를 로컬에서 실행하고, 학습 화면을 읽고, 인터랙티브 실험을 완료하는 방법을 설명합니다. 개발 구조나 새 lesson 작성법이 필요하다면 [README](../README.md)와 [Content authoring guide](content-authoring.md)를 참고하세요.

> **교육용 모델**
> 이 사이트의 계산 결과는 설정 변화의 원리와 방향을 학습하기 위한 것입니다. 실제 장비 정확도나 compliance 판정을 대신하지 않습니다. 실제 측정에서는 입력 레벨, calibration, reference plane, cable·fixture, mismatch, noise와 uncertainty를 다시 확인하세요.

## 1. 처음 실행하기

### 준비물

- Node.js 22.12.0 이상
- npm
- Chrome, Edge, Safari 같은 최신 브라우저

이 프로젝트에는 서버 계정, 환경 변수, 로그인 설정이 필요하지 않습니다.

### 개발 서버 실행

터미널에서 다음 명령을 실행합니다.

```bash
cd /Users/mark/Documents/rf-wiki
npm ci
npm run dev -- --host 127.0.0.1 --port 4326
```

브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:4326/
```

터미널에 표시된 `Local` 주소가 다르면 터미널의 주소를 우선합니다. 서버를 종료할 때는 실행 중인 터미널에서 `Ctrl+C`를 누릅니다.

### 실제 배포 결과와 같은 검색까지 확인

개발 서버에서는 Pagefind 전체 본문 검색 대신 내장 목차·용어 검색이 보일 수 있습니다. 전체 검색 인덱스까지 확인하려면 다음 순서로 실행합니다.

먼저 개발 서버를 `Ctrl+C`로 종료합니다. 같은 port에서 개발 서버와 preview를 동시에 실행할 수 없습니다.

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4326
```

`npm run build:site`만 실행하면 Pagefind 인덱스가 만들어지지 않습니다. 전체 확인에는 반드시 `npm run build`를 사용하세요.

## 2. 5분 안에 첫 실험 완료하기

아래 절차는 첫 번째 RF 기초 lesson의 주파수 실험을 예로 듭니다.

1. 홈에서 `첫 실험 시작`을 누릅니다.
2. intuition layer의 짧은 핵심 설명 바로 다음에 놓인 `주파수·케이블 위상 실험`에서 기본 주파수 1 GHz, 케이블 길이와 velocity factor를 먼저 읽습니다.
3. 첫 확인에서는 `주기 절반 · 위상 회전 2배`를 선택하고 `예측 고정`을 누릅니다.
4. 정답이면 설정 control이 열립니다. `기본 주파수`를 1 GHz에서 2 GHz로 바꿉니다.
5. 다음 네 곳을 같은 상태로 비교합니다.
   - Signal Spine에서 활성화된 stage
   - 시간 파형의 cycle과 period marker
   - phasor의 cable phase
   - Cause/Effect Ledger의 `변경 → 직접 효과 → 화면 결과 → 비용·한계`
6. `내 원인 설명`에 다음 구조로 적습니다.

   ```text
   주파수를 높였기 때문에 source의 주기가 줄고 같은 cable의 위상 회전은 커졌지만 velocity factor 오차 한계가 있다.
   ```

7. `설명으로 완료하기`를 누릅니다.
8. 홈으로 돌아가면 진행 위치와 `이어서 학습` 대상이 갱신됩니다.

예측이 틀리면 `놓친 stage가 있습니다.`라는 안내를 읽고 `다시 선택`을 누르세요. 설정값은 정답 예측을 고정하기 전까지 잠겨 있습니다.

## 3. 학습 화면 읽는 순서

### 전체 페이지 구조

큰 화면에서는 왼쪽의 compact 학습 지도와 오른쪽의 main document가 나란히 보입니다. 학습 지도는 `모듈 번호 + 짧은 제목`으로 현재 위치만 안내하며, 현재 항목에서만 질문을 덧붙입니다. 실험은 별도의 오른쪽 rail이 아니라 intuition layer 안의 짧은 핵심 설명 바로 다음에 main document 폭으로 나타납니다.

main document는 다음 한 흐름으로 읽습니다.

1. 현재 질문과 핵심 직관 설명
2. 인터랙티브 실험
3. 나머지 직관 세부 설명
4. 실무 조작·해석
5. 수식·규격과 참고자료

1024px 이하에서는 학습 지도가 접혀 있습니다. `학습 지도`를 누르면 여섯 학습 축을 펼칠 수 있습니다. 페이지와 학습 지도에는 별도의 가로 스크롤이 없으며, 위에서 아래로 한 번만 스크롤하면 됩니다.

### 세 가지 학습 깊이

각 lesson에는 다음 앵커가 있습니다.

| 단계 | 화면 문구 | 읽을 내용 |
|---|---|---|
| 1 | `직관 · 무엇이 보이나?` | 먼저 머릿속에 그릴 신호 그림 |
| 2 | `조작·해석 · 무엇을 바꿀까?` | 장비 설정과 실무 확인 순서 |
| 3 | `수식·규격 · 어떻게 검증할까?` | 식, convention, Release 17 근거와 한계 |

인터랙티브 실험은 1단계 intuition layer 안에 있습니다. 짧은 핵심 개념으로 예상한 움직임을 곧바로 실험하고, 같은 layer의 나머지 설명으로 mental model을 넓힌 뒤 bench layer에서 장비 설정과 측정 조건으로 해석합니다. 수식은 `수식 열기`, 그래프의 수치 데이터는 `그래프 값을 표로 보기`로 펼칠 수 있습니다.

## 4. 실험 하나를 완료하는 정확한 조건

모든 simulator는 다음 순서를 사용합니다.

```text
초기값 읽기 → 결과 예측 → 설정 하나 변경 → 연결된 결과 비교 → 원인 설명
```

### 1단계: 초기값 읽기

`초기 설정`에서 한 번에 하나의 control만 관찰합니다. 예측 전에는 control이 잠겨 있으므로 먼저 현재 값과 단위를 읽으세요.

### 2단계: 예측 고정

선택지를 고른 뒤 `예측 고정`을 누릅니다.

- 정답: `예측이 맞습니다.`가 표시되고 control이 열립니다.
- 오답: `놓친 stage가 있습니다.`가 표시됩니다. 해설을 읽고 `다시 선택`합니다.

예측과 정답 확인은 inline simulator 안에서 한 번만 진행됩니다. 같은 intuition layer에서 바로 앞의 짧은 핵심 설명을 읽고 simulator의 `먼저 결과를 예측해보세요`에 답하세요.

### 3단계: 설정값을 실제로 변경

정답 예측 후 control을 한 번 실제로 바꿔야 합니다. 슬라이더를 다른 값으로 움직이거나 select 항목을 바꾸세요. 별도 Apply 버튼은 없으며 결과는 즉시 갱신됩니다.

### 4단계: Linked Views와 Ledger 비교

- **Signal Spine:** 마지막 control 변경이 영향을 준 Source, DUT, Acquisition, DSP/Math, Display stage를 표시합니다.
- **Linked Views:** time, frequency, IQ, resource grid, Smith chart와 power flow가 같은 계산 상태를 보여줍니다.
- **Cause/Effect Ledger:** 무엇을 바꿨고, 내부에서 무엇이 달라졌으며, 화면과 측정 비용에 어떤 결과가 생겼는지 설명합니다.

`신호 흐름 일시정지`는 애니메이션만 멈춥니다. 계산과 control 갱신은 계속 동작합니다.

### 5단계: 자기 말로 설명

`내 원인 설명`에는 다음 네 요소가 필요합니다.

1. 공백을 제외하고 24자 이상
2. `때문에`, `따라서`, `→` 같은 원인 연결
3. 영향을 받은 stage 또는 처리 과정
4. 화면에서 본 결과와 비용·한계

설명이 부족하면 화면이 빠진 요소를 알려줍니다. 이 검사는 문장의 구조를 확인하는 것이며 AI가 RF 정답을 판정하는 기능은 아닙니다.

완료 후 설정을 다시 바꾸거나 `다시 선택`을 누르면 해당 실험의 완료 상태가 취소됩니다. 새 계산 상태를 다시 설명해야 합니다.

## 5. 여섯 학습 축에서 무엇을 조작하나요?

| 학습 축 | 경로 | 먼저 바꿔볼 control | 관찰할 핵심 |
|---|---|---|---|
| RF 기초 | `/learn/foundations/` | 기본 주파수, 케이블 길이, velocity factor | cycle 수, period, phasor와 cable phase |
| Spectrum·IQ | `/learn/spectrum-iq/` | RBW, frequency offset, common phase, detector | SA trace와 IQ가 보존하는 정보의 차이 |
| OFDM·LTE·NR | `/learn/ofdm-lte-nr/` | RAT, SCS, BWP, RB count/location, power mode | grid 위치, 실제 IFFT waveform과 QAM scaling |
| VNA·Smith | `/learn/vna-smith/` | R, X, line length, ΓS, ΓL | Γ↔Z, VSWR, reference plane, gain과 stability |
| Power flow·Coupling | `/learn/power-coupling/` | coupling, directivity, excess loss, return loss | input/through/coupled/isolated와 delivered power |
| PA·Pull | `/learn/pa-pull/` | source/load sweep, drive, Γ, contour metric | Pout, gain, PAE, EVM, ACLR 최적점의 차이 |

### 두 화면을 모두 완료해야 하는 학습 축

- `Spectrum·IQ`는 `SA trace`와 `IQ capture`를 각각 완료해야 한 축으로 집계됩니다.
- `VNA·Smith`는 `1-port · Γ / VSWR`와 `2-port · gain / stability`를 각각 완료해야 합니다.

탭을 전환해도 이미 변경한 설정값은 유지됩니다. 탭에는 마우스뿐 아니라 왼쪽·오른쪽 방향키와 `Home`, `End`를 사용할 수 있습니다.

## 6. 검색과 용어 사전 사용하기

### 전체 검색

상단 검색창에 장비 화면에서 본 표현을 그대로 입력합니다.

```text
RBW
S21
100 MHz RB
load-pull
```

`Enter` 또는 `찾기`를 누르면 `/search/?q=...`로 이동합니다.

- `전체 본문 결과`가 표시되면 Pagefind 인덱스를 사용한 검색입니다.
- `내장 목차·용어에서`가 표시되면 개발 서버의 fallback 검색입니다.

### 용어 사전

상단의 `용어 사전`을 열고 `Γ`, `isolation`, `기준면` 같은 용어나 기호를 입력합니다. 입력 즉시 결과가 좁혀지며, 각 용어의 `이 개념을 그림으로 보기 →`를 누르면 관련 lesson으로 이동합니다.

용어를 읽을 때는 다음 순서를 확인하세요.

1. 어느 port와 기준면인가
2. magnitude인가 complex 값인가
3. 양의 loss magnitude인가 signed dB 값인가
4. 어떤 bandwidth와 calibration 조건인가

## 7. 진도 저장과 초기화

> **진도와 개인정보**
> 완료 여부는 현재 브라우저에만 저장되며 로그인이나 기기 간 동기화는 없습니다. 사이트 데이터를 지우면 진도도 삭제됩니다. 작성한 원인 설명 문장은 저장되지 않습니다.

진도는 현재 브라우저의 `localStorage`에 `rf-wiki:v1:progress`라는 키로 저장됩니다.

- 같은 브라우저와 같은 주소에서 다시 열면 완료 상태가 복원됩니다.
- `localhost`와 `127.0.0.1`은 서로 다른 저장 공간입니다.
- 포트가 달라도 서로 다른 origin이므로 진도가 공유되지 않습니다.
- 홈의 진행 숫자는 완료한 simulator 수가 아니라 완료한 학습 축 `0 / 6`입니다.
- 순서를 건너뛸 수 있지만 `이어서 학습`은 가장 앞의 미완료 축을 가리킵니다.

전체 진도를 지우는 별도 화면 버튼은 없습니다. 브라우저 개발자 도구의 Console에서 다음 명령을 실행하면 현재 주소의 진도를 초기화할 수 있습니다.

```js
localStorage.removeItem('rf-wiki:v1:progress');
location.reload();
```

## 8. 키보드와 작은 화면에서 사용하기

- `Tab`과 `Shift+Tab`: 다음·이전 control로 이동
- `Enter` 또는 `Space`: button, 선택 가능한 marker 실행
- 방향키: slider 미세 조정
- `Home`과 `End`: slider 최솟값·최댓값, 실험 tab 처음·마지막으로 이동
- 왼쪽·오른쪽 방향키: SA/IQ 또는 VNA tab 전환
- 첫 번째 `Tab`: `본문으로 건너뛰기` 링크 표시

좁은 화면에서는 Signal Spine이 `Source → DUT → Acquisition → DSP/Math → Display` 순서로 위에서 아래로 표시됩니다. 실험도 `설정 → 예측 → 결과 → Cause/Effect Ledger → 설명` 순서로 이어지므로 좌우 스크롤할 필요가 없습니다. 움직임을 줄이는 OS 설정을 사용하면 신호 이동 애니메이션을 제거하고 상태 변화만 표시합니다.

## 9. 실행 문제 해결

### 주소가 열리지 않습니다

터미널에 `astro ... ready`와 `Local` 주소가 표시됐는지 확인합니다. 포트가 사용 중이면 다른 포트로 실행하세요.

```bash
npm run dev -- --host 127.0.0.1 --port 4327
```

Codex의 제한된 sandbox에서 `listen EPERM`이 나타날 수 있습니다. 이는 RF Wiki 오류가 아니라 로컬 port bind 권한 문제입니다. 일반 터미널에서 실행하거나 승인된 권한으로 서버를 시작하세요.

### `504 Outdated Optimize Dep`가 표시됩니다

오래 실행된 Astro/Vite 서버가 변경 전 dependency cache를 제공할 때 발생할 수 있습니다.

1. 해당 RF Wiki 터미널에서 `Ctrl+C`로 서버를 종료합니다.
2. 서버를 다시 실행합니다.
3. 계속되면 다음 명령으로 dependency를 재설치합니다.

   ```bash
   npm ci
   npm run dev -- --host 127.0.0.1 --port 4326
   ```

다른 프로젝트의 process를 PID만 보고 종료하지 마세요. 먼저 실행 경로가 `/Users/mark/Documents/rf-wiki`인지 확인합니다.

### 설정이 계속 잠겨 있습니다

simulator 안에서 답을 선택하고 `예측 고정`을 눌렀는지 확인합니다. 오답이면 `다시 선택` 후 올바른 방향을 예측해야 합니다.

### `설명으로 완료하기`가 비활성 상태입니다

다음 세 조건을 모두 확인하세요.

1. 정답 예측을 고정했는가
2. control 값을 실제로 한 번 변경했는가
3. 원인, stage, 화면 결과와 비용·한계를 포함해 설명했는가

버튼 위의 안내 문구가 현재 빠진 조건을 표시합니다.

### 검색 결과가 적습니다

개발 서버에서는 fallback 검색이 정상입니다. 전체 lesson 본문까지 검색하려면 `npm run build` 후 `npm run preview`를 사용하세요.

### 진도가 보이지 않습니다

이전에 사용한 브라우저 profile, hostname과 port가 같은지 확인하세요. 시크릿 창, 다른 브라우저, `localhost`와 `127.0.0.1`, 다른 port 사이에는 진도가 공유되지 않습니다.

## 10. 개발·검증 명령 참고표

| 목적 | 명령 |
|---|---|
| 개발 서버 | `npm run dev` |
| production build + 검색 index | `npm run build` |
| production preview | `npm run preview` |
| 기본 계약·typecheck·unit·build | `npm test` |
| 브라우저·접근성·시각 회귀 | `PLAYWRIGHT_PORT=4327 npm run test:e2e` |
| Lighthouse | `npm run audit:lighthouse` |
| 전체 검증 | `PLAYWRIGHT_PORT=4327 npm run test:all` |

브라우저 검증 도구가 설치되지 않았다면 한 번 실행합니다.

```bash
npx playwright install chromium
```

더 자세한 개발 명령과 프로젝트 구조는 [README](../README.md)를, 새 질문을 lesson으로 추가하는 방법은 [Content authoring guide](content-authoring.md)를 참고하세요.
