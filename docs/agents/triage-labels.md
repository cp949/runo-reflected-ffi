# Triage 라벨

스킬은 다섯 가지 표준 triage 역할을 사용한다. 이 문서는 각 역할을 이 저장소의
이슈 추적기에서 쓰는 실제 라벨 문자열에 매핑한다.

| mattpocock/skills의 라벨 | 이 저장소의 라벨   | 의미                                    |
| ------------------------ | ------------------ | --------------------------------------- |
| `needs-triage`           | `needs-triage`     | 관리자가 이슈를 검토해야 함             |
| `needs-info`             | `needs-info`       | 제보자의 추가 정보를 기다리는 중        |
| `ready-for-agent`        | `ready-for-agent`  | 명세가 완료되어 AFK 에이전트가 처리 가능 |
| `ready-for-human`        | `ready-for-human`  | 사람의 구현이 필요함                    |
| `wontfix`                | `wontfix`          | 처리하지 않기로 결정함                  |

스킬이 역할을 언급하면(예: "AFK 처리 가능 triage 라벨을 적용") 이 표에서 대응하는
라벨 문자열을 쓴다.

## 등록 상태

**등록 완료.** 다섯 라벨 모두 `cp949/runo-reflected-ffi`에 존재한다
(`wontfix`는 GitHub 기본 라벨, 나머지 4개는 아래 명령으로 등록했다).

```bash
gh label create needs-triage    -c fbca04 -d "관리자가 이슈를 검토해야 함"
gh label create needs-info      -c d4c5f9 -d "제보자의 추가 정보를 기다리는 중"
gh label create ready-for-agent -c 0e8a16 -d "명세가 완료되어 AFK 에이전트가 처리할 수 있음"
gh label create ready-for-human -c 1d76db -d "사람의 구현이 필요함"
```

`wontfix`는 GitHub가 저장소 생성 시 기본으로 만드는 라벨을 그대로 쓴다 — 별도
생성이 필요 없다.

실제 사용하는 라벨 명칭이나 색이 달라지면 위 두 표를 함께 수정한다.
