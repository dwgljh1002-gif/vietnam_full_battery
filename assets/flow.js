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
      fail: "데이터 저장에 실패했습니다. 인터넷 연결을 확인하고 담당자에게 문의해 주세요.",
    },
    vi: {
      done: "Bạn đã vất vả rồi.",
      saving: "Đang lưu dữ liệu…",
      saved: "Đã lưu dữ liệu.",
      next: "Sẽ tự động chuyển sang bài kiểm tra tiếp theo.",
      all: "Tất cả các bài kiểm tra đã kết thúc.",
      solo1: "Bài kiểm tra đã kết thúc.", solo2: "Kết quả đã được lưu. Cảm ơn bạn.", back: "Chọn bài kiểm tra khác",
      fail: "Lưu dữ liệu không thành công. Vui lòng kiểm tra kết nối mạng và liên hệ người phụ trách.",
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

  // DataPipe 저장 요청이 끝났는지(+ 성공했는지) 알기 위해 fetch 를 감싸서
  // 진행 중인 요청 수를 세고, 실패(네트워크 오류 또는 실패 응답)를 기록해 둡니다.
  // (이전 버전은 요청이 "끝났는지"만 보고 끝나면 무조건 "저장되었습니다"라고
  //  표시했는데, 이러면 업로드가 실제로 실패해도 화면에는 계속 성공으로 나와서
  //  문제가 있어도 알 수 없었습니다.)
  let pending = 0;
  let uploadFailed = false;
  let uploadErrorDetail = "";
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function () {
      const a = arguments;
      const url = typeof a[0] === "string" ? a[0] : (a[0] && a[0].url) || "";
      const p = origFetch.apply(this, a);
      if (/pipe\.jspsych\.org/.test(url)) {
        pending++;
        p.then(
          (res) => {
            pending--;
            if (res && res.ok === false) {
              uploadFailed = true;
              uploadErrorDetail = `HTTP ${res.status}`;
              console.error("[VIT] DataPipe 저장 실패:", res.status, url);
            }
          },
          (err) => {
            pending--;
            uploadFailed = true;
            uploadErrorDetail = String((err && err.message) || err);
            console.error("[VIT] DataPipe 저장 중 네트워크 오류:", err);
          }
        );
      }
      return p;
    };
  }

  const box = (inner) => `<div style="text-align:center;font-family:'Noto Sans KR','Segoe UI',sans-serif;padding:0 24px;">${inner}</div>`;
  const h1 = (t) => `<h1 id="vit-h" style="color:#1c3f94;font-size:34px;margin:0 0 14px;line-height:1.4;">${t}</h1>`;
  const sub = (t) => `<p id="vit-p" style="color:#667;font-size:20px;margin:0;">${t}</p>`;

  function target() { return document.querySelector(".jspsych-display-element") || document.body; }

  function showSoloDone() {
    const el = target();
    el.innerHTML = box(`<h1 style="color:#1c3f94;font-size:28px;margin:0 0 10px;">${T.solo1}</h1>
      <p style="color:#555;font-size:18px;margin:0 0 28px;">${T.solo2}</p>
      <a href="../index.html" style="display:inline-block;padding:16px 40px;background:#2554c7;color:#fff;border-radius:40px;font-weight:700;font-size:20px;text-decoration:none;">${T.back}</a>`);
  }

  function showFailure(headingHtml) {
    const el = target();
    el.innerHTML = box(h1(headingHtml) + sub(`${T.fail}${uploadErrorDetail ? ` (${uploadErrorDetail})` : ""}`));
  }

  function finish() {
    const el = target();
    const cur = readQueue();
    const solo = !inQueue || !cur;   // 한 검사만 단독으로 진행한 경우

    // 단독 실행이든 이어서 진행 중이든, "저장되었습니다"라고 보여주기 전에
    // 반드시 DataPipe 업로드 요청이 실제로 끝날 때까지 기다립니다.
    // (이전 버전은 단독 실행일 때 이 대기 없이 곧바로 "저장되었습니다"를 보여줬고,
    //  그래서 그 화면을 보고 바로 창을 닫으면 업로드가 끝나기도 전에 중단돼
    //  파일이 올라가지 않는 경우가 있었습니다. 특히 수리계산처럼 오래 걸리는
    //  검사를 단독으로 테스트할 때 이 문제가 두드러집니다.)
    el.innerHTML = box(h1(solo ? T.solo1 : T.done) + sub(T.saving));
    const t0 = Date.now();
    const timer = setInterval(() => {
      const waited = Date.now() - t0;
      if ((waited >= MIN_SAVE_WAIT_MS && pending === 0) || waited >= MAX_SAVE_WAIT_MS) {
        clearInterval(timer);

        if (uploadFailed) {
          showFailure(solo ? T.solo1 : T.done);
          return;
        }

        if (solo) {
          showSoloDone();
          return;
        }

        const last = cur.idx >= cur.tests.length - 1;
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
