# 학회 연구지도 · KAEIM Research Atlas

교육정보미디어연구의 논문·저자·분야·공저·내부 인용을 탐색하는 공개 테스트 사이트입니다. 원본 메타데이터를 변경하지 않는 정적 React 앱입니다.

공개 사이트: [GitHub Pages](https://taehyeonglim.github.io/kaeim-network/)

저장소: [taehyeonglim/kaeim-network](https://github.com/taehyeonglim/kaeim-network)

## 3D 탐색

지도 상단의 **3D** 버튼으로 입체 보기를 엽니다. [입체 네트워크 바로가기](https://taehyeonglim.github.io/kaeim-network/#dim=3d) · [연구분야 성단 바로가기](https://taehyeonglim.github.io/kaeim-network/#dim=3d&view=topics)

- 공저·인용 관계의 3D 배치와 연구분야별 입체 성단을 제공합니다.
- 드래그로 회전, 스크롤·핀치로 확대하고, 점을 선택하면 카메라가 이동하며 기존 상세 패널이 열립니다.
- 이름은 선택·호버하거나 가까이 접근했을 때 제한된 수만 표시합니다. 선택 시 주변 연결을 강조합니다.
- 검색·기간·분야 필터와 선택 상태는 2D/3D/목록 사이에서 유지됩니다. 공유 URL의 `dim=3d`도 복원됩니다.
- 기본 보기는 2D입니다. 3D 코드와 좌표는 필요할 때 불러오며, 실패 시 2D로 돌아갈 수 있습니다. 동작 줄이기 설정에서는 카메라 전환을 즉시 적용합니다.

`npm run data:3d`는 저장된 공개 스냅샷에서 입체 좌표만 다시 계산합니다. `npm run data`는 전체 공개 데이터와 2D·3D 좌표를 생성합니다. 좌표는 원본 데이터와 별도인 `public/data/layout-3d.json`에 저장하며 데이터 버전이 다르면 사용하지 않습니다.

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

별도 위치의 원본은 `python3 scripts/build_data.py --source /absolute/path/to/curated`로 지정한 뒤 `node scripts/layout.mjs`와 `node scripts/layout-3d.mjs`를 실행합니다. 빌더는 원본에 쓰지 않습니다. 원본 갱신 시 빌더의 수집 기준일과 데이터 테스트의 고정 스냅샷 해시·개수도 실제 근거에 맞춰 갱신해야 합니다.

정적 산출물은 `dist/`이며, 현재 배포 대상은 위의 GitHub Pages 사이트입니다. `main`에 푸시하면 검증과 배포가 자동 실행됩니다.

## 검증

- `npm test`: 공개 데이터의 논문·저자 기록, 공저 집계·인용 연결, 분류 근거, 검색·필터·지표 검사. 저장소를 복제한 환경과 GitHub Actions에서 실행할 수 있습니다.
- `npm run test:source`: 상위 경로에 원본 DB가 있는 환경에서 원본 해시 보존, 원본 대비 논문·저자 기록 보존, 독립적인 인용 매칭, 결측값과 분류 검사를 추가 수행합니다.
- `node scripts/browser-check.mjs`: 실행 중인 로컬 앱에서 Chromium으로 지도 클릭, 분야·기간 필터, 상세 근거, 비교, 공유, 모바일, embed를 검사합니다. 기본 주소는 `http://127.0.0.1:5173/`이며 `ATLAS_TEST_URL`로 변경할 수 있습니다. 로컬 Chrome이 필요합니다.
- `node scripts/browser-3d-check.mjs`: 3D 점 선택·카메라 초점·회전·확대·분야 성단·공유·모바일·실패 시 2D 전환을 검사합니다. 결과는 `docs/browser-3d-qa.json`에 저장합니다.
- `node scripts/browser-identity-check.mjs`: 통합 프로필·기존 링크·확인된 동명이인·보류·이름 및 소속 교정·모바일 검사를 수행합니다. 결과는 `docs/browser-identity-qa.json`에 저장합니다.
- 브라우저 실행 결과는 `docs/browser-qa.json`, 데이터 생성 결과는 `docs/data-build.json`에 기록합니다. 스크린샷은 상위 `tmp/atlas-qa/`에 저장합니다.

## 홈페이지 연동

우선 공개 사이트 주소를 메뉴에 연결합니다. 간소화 화면은 `?embed=1`로 열 수 있습니다. JAMS에서 iframe 삽입이 허용되는 경우에만 embed를 사용하고, 실제 호스트의 보안 정책과 모바일 높이를 확인합니다. URL의 해시에는 지도 종류, 기간, 분야, 검색어, 선택 대상이 저장됩니다.

## GitHub Pages 자동 배포

`main`에 푸시하면 `.github/workflows/pages.yml`이 의존성 설치 → 공개 데이터/모델 검사 → Vite 빌드 → Pages 배포를 수행합니다. GitHub의 Settings → Pages에서 배포 소스는 GitHub Actions입니다. 별도 API 키나 원본 DB 없이 저장된 공개 스냅샷으로 빌드합니다.

Vite의 상대 경로(`base: './'`)를 사용하므로 프로젝트 경로 `/kaeim-network/`와 기존 Sites 주소에서 모두 동작합니다. 해시 기반 공유 링크도 같은 경로를 유지합니다. 기존 Sites 배포는 별도로 유지되며 GitHub 푸시가 Sites를 자동 갱신하지는 않습니다.

## 변경 위치

- `config/taxonomy.json`: 학술 분야·정책 과제, 색상, 근거 탐지 규칙.
- `config/identity-review.json`: 사용자 확인 통합·분리·보류 및 표기 교정 이력. 현재 295개 이름 반영, 33개 이름 판단 보류.
- `scripts/identity_review.py`: 검토 기록 적용 및 충돌 검사. 기존 프로필 URL 연결 유지.
- `config/identity-overrides.json`: 소속 약칭과 근거 있는 연구자 식별 교정. 임의 병합 금지.
- `scripts/build_data.py`, `scripts/layout.mjs`: 서비스용 데이터와 결정적 지도 배치.
- `src/model.ts`: 검색·필터·집계 의미.
- `src/App.tsx`, `src/Network.tsx`, `src/style.css`: 화면·네트워크·반응형 표현.

회원 명부와 외부 학술지의 피인용 논문 목록은 포함하지 않습니다. 일부 현재 소속·직위는 사용자 확인 정보로 구분합니다. 전체 설명은 [해석 및 데이터 기준](docs/METHODOLOGY.md)을 확인하세요.
