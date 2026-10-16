/* ════════════════════════════════════════════════════════════════════════
   여러 소검사를 이어서 진행하는 공통 스크립트 (모든 검사 페이지가 불러옵니다)
   - 검사 선택 화면에서 고른 검사 목록(vit_queue)을 순서대로 진행합니다.
   - 각 검사가 끝나면 "수고하셨습니다." 화면에서 데이터를 저장(파일명: 코드명_소검사명.csv)한 뒤
     다음 검사 페이지로 자동 이동하고, 마지막 검사까지 끝나면 종료 문구를 보여줍니다.
   - 문구·파일명 수정은 아래 TEXT / FILE_NAMES 만 고치면 됩니다.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  // 저장되는 파일명에 쓰이는 소검사 이름 (폴더명 → 파일명)
  const FILE_NAMES = {
    math: "수리계산", common_meaning: "공통의미", vocabulary: "단어이해",
    perceptual_org: "지각조직", motor: "지각운동", logic: "논리추론",
  };
  // 검사 사이/종료 화면 문구
  const TEXT = {
    ko: {
      done: "수고하셨습니다.",
      saving: "데이터를 저장하고 있습니다…",
      saved: "데이터가 저장되었습니다.",
      next: "잠시 후 다음 검사로 이동합니다.",
      all: "모든 검사가 종료되었습니다.",
      solo1: "검사가 종료되었습니다.", solo2: "결과가 저장되었습니다. 수고하셨습니다.", back: "다른 검사 선택하기",
    },
    vi: {
      done: "Bạn đã vất vả rồi.",
      saving: "Đang lưu dữ liệu…",
      saved: "Đã lưu dữ liệu.",
      next: "Sẽ tự động chuyển sang bài kiểm tra tiếp theo.",
      all: "Tất cả các bài kiểm tra đã kết thúc.",
      solo1: "Bài kiểm tra đã kết thúc.", solo2: "Kết quả đã được lưu. Cảm ơn bạn.", back: "Chọn bài kiểm tra khác",
    },
  };
  const MIN_SAVE_WAIT_MS = 3500;    // 저장 요청이 시작될 시간을 주기 위한 최소 대기
  const MAX_SAVE_WAIT_MS = 20000;   // 저장이 이보다 오래 걸려도 다음으로 진행
  const NEXT_DELAY_MS = 1500;       // 저장 완료 후 다음 검사로 넘어가기 전 잠깐 보여주는 시간

  const parts = location.pathname.split("/").filter(Boolean);
  if (/\.html?$/i.test(parts[parts.length - 1] || "")) parts.pop();
  const testId = parts[parts.length - 1] || "";
  const lang = parts.includes("vi") ? "vi" : "ko";
  const T = TEXT[lang];

  const readQueue = () => { try { return JSON.parse(localStorage.getItem("vit_queue") || "null"); } catch (e) { return null; } };
  const writeQueue = (q) => { try { if (q) localStorage.setItem("vit_queue", JSON.stringify(q)); else localStorage.removeItem("vit_queue"); } catch (e) {} };
  const queue = readQueue();
  const inQueue = !!(queue && Array.isArray(queue.tests) && queue.tests[queue.idx] === testId);

  // DataPipe 저장 요청이 끝났는지 알기 위해 fetch 를 감싸서 진행 중인 요청 수를 셉니다.
  let pending = 0;
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function () {
      const a = arguments;
      const url = typeof a[0] === "string" ? a[0] : (a[0] && a[0].url) || "";
      const p = origFetch.apply(this, a);
      if (/pipe\.jspsych\.org/.test(url)) {
        pending++;
        p.then(() => { pending--; }, () => { pending--; });
      }
      return p;
    };
  }

  const box = (inner) => `<div style="text-align:center;font-family:'Noto Sans KR','Segoe UI',sans-serif;padding:0 24px;">${inner}</div>`;
  const h1 = (t) => `<h1 id="vit-h" style="color:#1c3f94;font-size:34px;margin:0 0 14px;line-height:1.4;">${t}</h1>`;
  const sub = (t) => `<p id="vit-p" style="color:#667;font-size:20px;margin:0;">${t}</p>`;

  function target() { return document.querySelector(".jspsych-display-element") || document.body; }

  function finish() {
    const el = target();
    const cur = readQueue();
    if (!inQueue || !cur) {   // 한 검사만 단독으로 진행한 경우 (기존 동작)
      el.innerHTML = box(`<h1 style="color:#1c3f94;font-size:28px;margin:0 0 10px;">${T.solo1}</h1>
        <p style="color:#555;font-size:18px;margin:0 0 28px;">${T.solo2}</p>
        <a href="../index.html" style="display:inline-block;padding:16px 40px;background:#2554c7;color:#fff;border-radius:40px;font-weight:700;font-size:20px;text-decoration:none;">${T.back}</a>`);
      return;
    }
    const last = cur.idx >= cur.tests.length - 1;
    el.innerHTML = box(h1(T.done) + sub(T.saving));
    const t0 = Date.now();
    const timer = setInterval(() => {
      const waited = Date.now() - t0;
      if ((waited >= MIN_SAVE_WAIT_MS && pending === 0) || waited >= MAX_SAVE_WAIT_MS) {
        clearInterval(timer);
        if (last) {
          writeQueue(null);
          el.innerHTML = box(h1(`${T.done}<br>${T.all}`));
        } else {
          cur.idx += 1; writeQueue(cur);
          const p = document.getElementById("vit-p");
          if (p) p.textContent = `${T.saved} ${T.next}`;
          setTimeout(() => { location.href = `../${cur.tests[cur.idx]}/index.html`; }, NEXT_DELAY_MS);
        }
      }
    }, 200);
  }

  window.VIT = {
    testId, lang, inQueue,
    // 저장 파일명: 코드명_소검사명.csv (코드명이 없으면 임의 ID 사용)
    fileName: (subjectId) => `${subjectId}_${FILE_NAMES[testId] || testId}.csv`,
    // 선택한 검사를 이어서 진행하는 중이면 마지막 "스페이스 바" 화면을 건너뜁니다.
    endStimulus: (html) => (inQueue ? "" : html),
    endDuration: () => (inQueue ? 50 : null),
    finish,
  };
})();
