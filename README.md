# 강정이네 웨딩 가든

**[웨딩 가든 앱 열기](https://jeoungan.github.io/Visitor-s_book/)**

GitHub Pages는 `public/`에서 만든 앱 전용 `dist/`를 GitHub Actions로 배포합니다. Pages에서는 캐릭터 꾸미기·이동·동작과 메시지 저장을 사용할 수 있으며, 작성 내용은 **이 브라우저에만 저장되고 다른 방문자나 신랑·신부에게 전송되지 않습니다.** 공용 방명록은 아래 Node/SQLite 서버 모드이며 별도 서버 배포가 필요합니다.

배포 작업은 [프로젝트 지침](AGENTS.md)과 [배포·검증 절차](docs/DEPLOYMENT.md)를 따릅니다. `npm run build:pages`로 정적 앱을 만들고 `node tools/preview_pages.mjs`로 실제 Pages 하위 경로를 로컬에서 확인할 수 있습니다. 공개 배포는 해당 커밋의 Actions 성공 및 실제 앱 화면을 확인해야 완료입니다.

저장소: [jeoungan/Visitor-s_book](https://github.com/jeoungan/Visitor-s_book)

새 대화에서 이어서 작업할 때는 [인수인계 문서](docs/HANDOFF.md)를 먼저 읽으세요. 최신 작업은 2026-09-20 `20260920-celebration4`이며 **문법 검사와 자동 테스트 82개를 통과**했습니다. 예시 하객18명, 약1.6배 커진 신랑·신부와 조명/명패, 빙그르 제거를 실제 모바일·데스크톱 화면에서 확인했습니다. 이전 목 연결·산책·말풍선 보정도 유지합니다. 최종 전달 상태는 인수인계 문서 맨 위에서 확인합니다. 기존15분 자동 리뷰는 중지 상태를 유지합니다.

휴대폰 화면을 가득 채우는 예식장, 의상별 손인사·춤·박수, 이동 중에만 보이는 좌우·뒷모습을 지원합니다. 꾸벅·폴짝·하트·빙그르는 제거하고 기존 저장값은 기본 자세로 호환합니다. 예시 하객은18명이며 가까워지면 잠시 양보한 뒤 걷습니다. 신랑·신부는184px 크기로 표시하고 레이스 드레스를 유지합니다. 자동 말풍선은6~7초 유지하고 같은 하객은 사라진 뒤8초를 쉽니다. 폭960px 미만 최대2개, 그 이상 최대3개를 순차적으로 표시하며 표시 도중 하객을 교체하지 않습니다. 클릭한 메시지는7초 유지하며 이때 자동 말풍선은 잠시 쉽니다.

새 이미지 구성은 16의상×3리액션×4프레임=192개 몸 전체 포즈, 16의상×4방향×2프레임=128개 걷기 프레임, 16헤어×좌우/뒤 3방향=48개 방향별 머리입니다. 기존 정면 머리를 보존하고 모든 자세 원본을 built-in image generation으로 새로 생성합니다. `public/assets/poses-v2/`의 atlas·피부 마스크·manifest를 함께 사용하며 기존 정면 이미지의 팔·다리를 잘라 동작을 만드는 경로는 제거했습니다.

Node.js 24 이상에서 `npm start` 후 http://127.0.0.1:4173/guestbook/ 를 엽니다. 별도 npm 의존성이 없습니다.

방명록은 `data/garden.sqlite`에 저장됩니다. 이 디렉터리를 보존해야 합니다. 쿠키가 남아 있는 같은 브라우저에서 내 메시지를 수정/삭제할 수 있습니다. 공개 배포 전 HTTPS, 영구 저장 볼륨, 외부 접속 설정이 필요합니다. 기본 서버는 127.0.0.1에만 바인딩합니다.

설정: `PORT`(기본 4173), `GARDEN_DB`(DB 절대 경로), `INVITATION_URL`(실제 청첩장 주소), `NODE_ENV=production`(Secure cookie).

검사: `npm run check`, `npm test`. 테스트는 임시 DB와 별도 4187 포트를 사용해 실제 방명록을 건드리지 않습니다.

이미지 조립은 `python tools/build_pose_atlas.py --only all --require-complete`(Pillow/NumPy 필요), 오프라인 렌더 검토는 `node tools/review_avatar_poses.mjs`(`NODE_PATH`에서 `@napi-rs/canvas` 사용)입니다. 이미지 원본·프롬프트는 `public/assets/poses-v2/raw/`, 검토 결과는 `artifacts/pose-atlas/`와 `artifacts/pose-renderer/`에 저장됩니다. 자세한 셀·방향·정렬 계약과 검증 근거는 인수인계 문서를 따릅니다.

기능 상태와 반복 리뷰는 [docs/reviews.md](docs/reviews.md)에 기록합니다. 사진은 브라우저 내부에서 색감만 분석합니다. 사진 AI 생성 서비스는 아직 연결되지 않았습니다.

저장소에는 앱 소스, 실행에 필요한 이미지, 테스트, 개발 문서를 포함합니다. 실제 방명록 `data/`, 환경설정 비밀값, 로그, 로컬 검증 산출물 `artifacts/`와 이미지 생성 경로 메타파일은 Git에서 제외합니다. 새로 복제한 프로젝트에서는 최초 실행 시 빈 방명록 DB를 생성합니다. GitHub 푸시만으로 웹사이트가 공개 배포되지는 않습니다.

최초 버전은 `main`의 `004181490618f0fad541a6727610e2bdb474dab6`으로 푸시했습니다. 현재 전달 커밋과 원격 반영 상태는 `git log -1`, `git status`, 원격 `main`을 확인하세요. Pages 앱과 공용 방명록 서버의 배포를 구분합니다. 실제 청첩장 URL과 공용 Node/SQLite 서버의 인터넷 배포는 아직 연결되지 않았습니다.
