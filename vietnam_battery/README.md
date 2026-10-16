# 베트남 지능검사 단축형 (정적 페이지)

GitHub Pages에서 저장소 최상위(root)에 아래 구조가 그대로 올라가면 됩니다. (별도 상위 폴더 없음)

    index.html                  1단계: 언어 선택 (한국어 / Tiếng Việt)   ← "Visit site" 첫 화면
    ko/index.html               2단계: 검사 선택 (왼쪽 언어이해표현 / 오른쪽 지각운동협응)
    vi/index.html
    ko/<검사폴더>/index.html     각 검사 (타이틀 → 지시문 → 문항 → 종료)
    vi/<검사폴더>/index.html
      └ images/title-slide.png  각 검사 첫 화면 이미지
    assets/logic/               논리추론 그림 (한국어·베트남어 공용)

검사 폴더: math(수리계산), common_meaning(공통의미), perceptual_org(지각조직), motor(지각운동), logic(논리추론)
단어이해는 아직 "준비 중"으로 비활성 표시되어 있습니다.

## 수리계산 (math)
ko/math/index.html, vi/math/index.html 은 기존 파일 그대로입니다.
기존 images 폴더(title-slide.png)를 각각 ko/math/images, vi/math/images 로 복사해 주세요.

## 새 검사 추가 방법
1) ko/ 와 vi/ 아래에 검사 폴더를 만들고 index.html 과 images/title-slide.png 를 넣습니다.
2) ko/index.html, vi/index.html 의 해당 영역(언어이해표현 또는 지각운동협응)에
   <a class="card" href="./폴더명/index.html">검사 이름</a> 한 줄을 추가합니다.
   (단어이해는 <span class="card disabled">…</span> 를 <a class="card" href="./vocabulary/index.html">…</a> 로 바꾸면 됩니다.)

## 저장되는 CSV (검사·언어·참가자별 1파일: 검사명_언어_참가자ID.csv)
- 공통: language, item_index, correct_answer, response, correct, score, rt(첫 반응시간 ms), administered(중지 규칙으로 건너뛴 문항은 false)
- 지각조직: grid, presentation(upright/rotated), time_limit_sec, omission, false_alarm, time_bonus, decision_time, total_rt,
  placement_count(블록 배치 횟수), cancel_count(두 번 눌러 취소), reset_count(선택 초기화), attempt_count(=reset_count+1)
- 지각운동: row, col, false_alarm, elapsed_time(본 검사 시작 후 경과 ms), completion_time(검사 완료 시간; 2분 안에 다 못 풀면 120000)
- 논리추론: stimulus_id, time_limit_sec, omission, false_alarm, decision_time, total_rt

## 검사 규칙 요약
- 지각조직: 10문항(2×2 6개, 3×3 4개), 제한시간 60초/90초, 점수 2·1·0(시간 보너스), 5문항 연속 0점 시 중지
- 지각운동: 예시 20 + 본 150문항(10개씩 한 줄), 본 검사 총 2분, 중지 규칙 없음
- 논리추론: 예시 1 + 연습 4 + 본 30문항, 문항별 제한시간 30/90/120초, 5문항 연속 0점 시 중지
