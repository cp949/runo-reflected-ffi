# 이슈 트래커: GitHub

이 저장소의 발견 작업, 실행 계획과 진행 상태는 GitHub Issues(`cp949/runo-reflected-ffi`)에서
관리한다. 모든 작업에 `gh` CLI를 사용한다.

**현재 상태**: 로컬 저장소에 git remote가 아직 없다(git 이력 재초기화 예정).
`packages/reflected-ffi/package.json`의 `repository`/`bugs` 필드가 가리키는
`cp949/runo-reflected-ffi`가 목표 저장소다. remote가 없는 동안에는 `gh` 명령에
`-R cp949/runo-reflected-ffi`를 명시하거나 `gh repo set-default cp949/runo-reflected-ffi`로
기본 저장소를 지정한다.

## 기본 명령

- **이슈 생성**: `gh issue create --title "..." --body "..."`. 여러 줄 본문은 임시
  파일과 `--body-file`을 사용한다.
- **이슈 조회**: `gh issue view <번호> --comments`
- **이슈 목록**: `gh issue list --state open --json number,title,body,labels,comments`
- **댓글 작성**: `gh issue comment <번호> --body "..."`
- **라벨 적용/제거**: `gh issue edit <번호> --add-label "..."` / `--remove-label "..."`
- **이슈 종료**: `gh issue close <번호> --comment "..."`

remote가 설정되면 저장소는 `git remote -v`에서 자동 추론된다 — 그때부터 `-R` 플래그는
선택사항이다.

## 게시 승인

에이전트는 사용자 지시 없이 GitHub에 쓰지 않는다. 읽기(`gh issue view`,
`gh issue list`, `gh api` 조회)는 언제든 실행한다.

쓰기에 해당하는 것: 이슈 생성, 댓글 작성, 이슈 수정, 이슈 종료, 라벨과 assignee
변경, sub-issue와 dependency 연결.

사용자가 등록·게시를 지시하면 그 지시가 해당 실행의 쓰기 허가다. 게시 직전에 무엇을
올릴지 제시하고 확인을 받는다. 초안에서 API 키·비밀번호·개인정보를 제거한 뒤
게시한다.

## 종료 판단

닫을지는 완료 기준 충족 여부로 에이전트가 판단한다.

**모두 참이면 닫는다.**

- 이 실행에서 그 이슈에 완료 댓글을 등록했다.
- 완료 보고에 미충족 완료 기준이 없다.
- 이슈가 열려 있다.

**하나라도 거짓이면 닫지 않는다** — 특히 완료 기준은 충족했지만 후속 작업이
별도 이슈로 분리되지 않은 경우, 판단이 서지 않는 경우.

닫힌 이슈는 다시 열지 않는다. 종료는 상태만 바꾸고 별도 댓글을 붙이지 않는다.

## Pull Request를 요청 표면으로 사용할지 여부

**PR을 요청 표면으로 사용하지 않는다.** 외부 PR을 기능 요청이나 triage 대기열로
취급하지 않는다.

GitHub는 Issue와 PR이 번호 공간을 공유한다. `#42`가 어느 쪽인지 불분명하면
`gh pr view 42`를 먼저 시도하고 실패하면 `gh issue view 42`를 쓴다.

## 스킬 표현의 의미

### "이슈 트래커에 게시한다"

GitHub Issue를 생성한다.

### "관련 티켓을 조회한다"

`gh issue view <번호> --comments`로 본문과 댓글을 함께 읽는다.

## Wayfinding 작업

map은 하나의 상위 Issue이고 child는 실행 가능한 하위 Issue다.

- **Map**: Notes, Decisions-so-far와 Fog를 본문에 가진 단일 Issue다. `wayfinder:map`
  라벨을 사용한다.
- **Child**: GitHub sub-issue로 map에 연결한다. sub-issue를 쓸 수 없으면 map 본문의
  task list에 추가하고 child 본문 첫 줄에 `Part of #<map 번호>`를 기록한다. 종류는
  `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`,
  `wayfinder:task` 중 해당 라벨을 쓴다.
- **차단 관계**: GitHub native issue dependency를 우선 사용한다. 안 되면 child 본문
  첫 줄에 `Blocked by: #<번호>`를 기록한다.
- **Frontier**: map 순서대로 열린 child를 조회하고, 열린 blocker나 assignee가 있는
  항목을 제외한 첫 항목을 선택한다.
- **Claim**: `gh issue edit <번호> --add-assignee @me`.
- **Resolve**: 결론과 근거를 댓글로 남기고 child를 종료한 뒤 map의
  Decisions-so-far에 결정 링크를 추가한다.

Native dependency의 blocker database ID는 다음으로 조회한다.

```bash
gh api repos/<owner>/<repo>/issues/<번호> --jq .id
gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-database-id>
```
