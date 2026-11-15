# 학회 연구지도 · KAEIM Research Atlas

교육정보미디어연구의 논문·저자·분야·공저·내부 인용을 탐색하는 공개 테스트 사이트입니다. 원본 메타데이터를 변경하지 않는 정적 React 앱입니다.

## 실행

Node.js 22 이상, Python 3.10 이상을 사용합니다.

```sh
npm ci
npm run dev
```

공개용 데이터가 `public/data/`에 포함되어 있어 사이트 자체는 외부 API나 비밀키 없이 실행됩니다.

## 데이터 갱신

저장소 상위 경로의 `data/curated/metadata.json`과 `data/curated/references.json`이 입력입니다.

```sh
npm run data
npm test
npm run build
npm run preview
```

별도 위치의 원본은 `python3 scripts/build_data.py --source /absolute/path/to/curated`로 지정한 뒤 `node scripts/layout.mjs`를 실행합니다. 빌더는 원본에 쓰지 않습니다. 원본 갱신 시 빌더의 수집 기준일과 데이터 테스트의 고정 스냅샷 해시·개수도 실제 근거에 맞춰 갱신해야 합니다.

정적 산출물은 `dist/`이며, Sites 배포 식별자는 `.openai/hosting.json`에 저장합니다. 같은 사이트를 수정할 때 새 사이트를 만들지 않습니다. 배포는 Sites 스킬의 소스 동기화·아카이브 저장·공개 배포 절차를 사용합니다.

## 검증

- `npm test`: 원본 해시 보존, 논문·저자 기록 보존, 독립적인 공저/인용 재계산, 결측값, 분류 근거, 검색·필터·지표 검사.
- `node scripts/browser-check.mjs`: 실행 중인 로컬 앱에서 Chromium으로 지도 클릭, 분야·기간 필터, 상세 근거, 비교, 공유, 모바일, embed를 검사합니다. 기본 주소는 `http://127.0.0.1:5173/`이며 `ATLAS_TEST_URL`로 변경할 수 있습니다. 로컬 Chrome이 필요합니다.
- 브라우저 실행 결과는 `docs/browser-qa.json`, 데이터 생성 결과는 `docs/data-build.json`에 기록합니다. 스크린샷은 상위 `tmp/atlas-qa/`에 저장합니다.

## 홈페이지 연동

우선 공개 사이트 주소를 메뉴에 연결합니다. 간소화 화면은 `?embed=1`로 열 수 있습니다. JAMS에서 iframe 삽입이 허용되는 경우에만 embed를 사용하고, 실제 호스트의 보안 정책과 모바일 높이를 확인합니다. URL의 해시에는 지도 종류, 기간, 분야, 검색어, 선택 대상이 저장됩니다.

## 변경 위치

- `config/taxonomy.json`: 학술 분야·정책 과제, 색상, 근거 탐지 규칙.
- `config/identity-overrides.json`: 소속 약칭과 근거 있는 연구자 식별 교정. 임의 병합 금지.
- `scripts/build_data.py`, `scripts/layout.mjs`: 서비스용 데이터와 결정적 지도 배치.
- `src/model.ts`: 검색·필터·집계 의미.
- `src/App.tsx`, `src/Network.tsx`, `src/style.css`: 화면·네트워크·반응형 표현.

회원 명부, 현재 직위·소속, 외부 학술지의 피인용 논문 목록은 포함하지 않습니다. 전체 설명은 [해석 및 데이터 기준](docs/METHODOLOGY.md)을 확인하세요.
