/* ════════════════════════════════════════════════════════════════════════
   여러 소검사를 이어서 진행하는 공통 스크립트 (모든 검사 페이지가 불러옵니다)
   - 검사 선택 화면에서 고른 검사 목록(vit_queue)을 순서대로 진행합니다.
   - 각 검사가 끝나면 "수고하셨습니다." 화면에서 데이터를 저장(파일명: 코드명_소검사명.csv)한 뒤
     다음 검사 페이지로 자동 이동하고, 마지막 검사까지 끝나면 종료 문구를 보여줍니다.
   - 문구·파일명 수정은 아래 TEXT / FILE_NAMES 만 고치면 됩니다.

   ■ 저장(DataPipe) 관련 안전장치
     1) 같은 파일명이 이미 있으면(FILE_EXISTS) 코드명_소검사명_2.csv, _3.csv … 로 자동 재시도합니다.
        (DataPipe 는 같은 이름을 "덮어쓰지 않고 거절"하며, 드라이브에서 파일을 직접 지워도
         DataPipe 는 그 이름을 이미 쓴 것으로 기억합니다. → 같은 코드명으로 다시 검사하면
         저장이 거절되고 파일 대신 ".partial" 파일만 남는 것이 수리계산에서 생긴 문제였습니다.)
     2) 그래도 저장이 실패하면 실패 사유(HTTP 상태/서버 메시지)를 화면에 보여주고,
        결과 CSV 를 수검자 컴퓨터로 자동 내려받아(백업) 데이터가 사라지지 않게 합니다.
     3) 실패해도 "다음 검사로 계속하기" 버튼으로 나머지 검사를 이어서 진행할 수 있습니다.
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
      savedAs: "같은 이름의 파일이 이미 있어 다음 이름으로 저장했습니다:",
      next: "잠시 후 다음 검사로 이동합니다.",
      all: "모든 검사가 종료되었습니다.",
      solo1: "검사가 종료되었습니다.", solo2: "결과가 저장되었습니다. 수고하셨습니다.", back: "다른 검사 선택하기",
      fail: "데이터 저장에 실패했습니다. 담당자에게 문의해 주세요.",
      backupDone: "결과 파일(CSV)을 이 컴퓨터에 내려받았습니다. 담당자에게 전달해 주세요.",
      backupBtn: "결과 파일 다시 내려받기",
      cont: "다음 검사로 계속하기",
    },
    vi: {
      done: "Bạn đã vất vả rồi.",
      saving: "Đang lưu dữ liệu…",
      saved: "Đã lưu dữ liệu.",
      savedAs: "Đã có tệp trùng tên nên dữ liệu được lưu với tên:",
      next: "Sẽ tự động chuyển sang bài kiểm tra tiếp theo.",
      all: "Tất cả các bài kiểm tra đã kết thúc.",
      solo1: "Bài kiểm tra đã kết thúc.", solo2: "Kết quả đã được lưu. Cảm ơn bạn.", back: "Chọn bài kiểm tra khác",
      fail: "Lưu dữ liệu không thành công. Vui lòng liên hệ người phụ trách.",
      backupDone: "Tệp kết quả (CSV) đã được tải về máy này. Vui lòng gửi cho người phụ trách.",
      backupBtn: "Tải lại tệp kết quả",
      cont: "Tiếp tục bài kiểm tra tiếp theo",
    },
  };
  const MIN_SAVE_WAIT_MS = 3500;    // 저장 요청이 시작될 시간을 주기 위한 최소 대기
  const MAX_SAVE_WAIT_MS = 20000;   // 저장이 이보다 오래 걸려도 다음으로 진행
  const NEXT_DELAY_MS = 1500;       // 저장 완료 후 다음 검사로 넘어가기 전 잠깐 보여주는 시간
  const MAX_RENAME_TRIES = 20;      // 파일명이 겹칠 때 _2 … _N 까지 시도

  const parts = location.pathname.split("/").filter(Boolean);
  if (/\.html?$/i.test(parts[parts.length - 1] || "")) parts.pop();
  const testId = parts[parts.length - 1] || "";
  const lang = parts.includes("vi") ? "vi" : "ko";
  const T = TEXT[lang];

  const readQueue = () => { try { return JSON.parse(localStorage.getItem("vit_queue") || "null"); } catch (e) { return null; } };
  const writeQueue = (q) => { try { if (q) localStorage.setItem("vit_queue", JSON.stringify(q)); else localStorage.removeItem("vit_queue"); } catch (e) {} };
  const queue = readQueue();
  const inQueue = !!(queue && Array.isArray(queue.tests) && queue.tests[queue.idx] === testId);

  // ── DataPipe 저장 요청 감시 ──────────────────────────────────────────
  let pending = 0;               // 진행 중인 저장 요청 수
  let uploadFailed = false;      // 최종적으로 저장에 실패했는지
  let uploadErrorDetail = "";    // 화면에 보여줄 실패 사유
  let savedAsName = "";          // 파일명이 겹쳐 바뀐 경우 최종 저장 이름
  let backup = null;             // 실패 시 백업용 { filename, data }

  const isPipeSave = (url) => /pipe\.jspsych\.org\/api\/data/.test(url || "");

  // 요청 본문(JSON, gzip 압축일 수 있음) → { obj, gz }. 읽을 수 없으면 null.
  async function readPayload(body) {
    let u8;
    if (typeof body === "string") u8 = new TextEncoder().encode(body);
    else if (body instanceof Blob) u8 = new Uint8Array(await body.arrayBuffer());
    else if (body instanceof ArrayBuffer) u8 = new Uint8Array(body);
    else if (ArrayBuffer.isView(body)) u8 = new Uint8Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength));
    else return null;
    const gz = u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b;
    let text;
    if (gz) text = await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    else text = new TextDecoder().decode(u8);
    return { obj: JSON.parse(text), gz };
  }
  async function writePayload(obj, gz) {
    const json = JSON.stringify(obj);
    if (!gz) return json;
    return await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
  }

  // 응답이 "성공"인지 판단 (HTTP 200 이어도 본문에 error 가 있으면 실패) + 본문 텍스트 반환
  async function judge(res) {
    let text = "";
    try { text = await res.clone().text(); } catch (e) {}
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) {}
    const bodyError = body && typeof body === "object" && body.error ? String(body.error) : "";
    // 202(접수되어 나중에 저장됨)는 DataPipe 문서상 성공으로 취급
    const ok = res.ok && !bodyError && !(text && /FILE_EXISTS/.test(text));
    return { ok, text, status: res.status, bodyError };
  }

  const addSuffix = (name, n) => name.replace(/(\.[^./]+)?$/, `_${n}$1`);

  // 저장 요청 1건 처리: 전송 → (파일명 중복이면 이름 바꿔 재시도) → 실패하면 백업 자료 확보
  async function saveWithFallback(input, init) {
    const hasInit = init && typeof init === "object";
    let payload = null;
    if (hasInit) { try { payload = await readPayload(init.body); } catch (e) { payload = null; } }

    let res;
    try {
      res = await origFetch.call(window, input, init);
    } catch (err) {
      uploadFailed = true;
      uploadErrorDetail = "네트워크 오류: " + String((err && err.message) || err);
      if (payload) backup = { filename: payload.obj.filename, data: payload.obj.data };
      console.error("[VIT] DataPipe 저장 중 네트워크 오류:", err);
      throw err;
    }
    let j = await judge(res);

    // 같은 이름의 파일이 이미 있는 경우 → 이름 뒤에 _2, _3 … 을 붙여 다시 저장
    if (!j.ok && payload && /FILE_EXISTS/.test(j.text)) {
      const baseName = payload.obj.filename;
      for (let n = 2; n <= MAX_RENAME_TRIES && !j.ok; n++) {
        const newName = addSuffix(baseName, n);
        try {
          const body = await writePayload(Object.assign({}, payload.obj, { filename: newName }), payload.gz);
          const res2 = await origFetch.call(window, input, Object.assign({}, init, { body }));
          const j2 = await judge(res2);
          console.warn(`[VIT] ${baseName} 이(가) 이미 있어 ${newName} 으로 재시도 →`, j2.status);
          if (j2.ok) { res = res2; j = j2; savedAsName = newName; break; }
          if (!/FILE_EXISTS/.test(j2.text)) { res = res2; j = j2; break; }   // 다른 종류의 실패면 중단
        } catch (e) { console.error("[VIT] 재시도 실패:", e); break; }
      }
    }

    if (!j.ok) {
      uploadFailed = true;
      let msg = `HTTP ${j.status}`;
      if (j.bodyError) msg += ` · ${j.bodyError}`;
      else if (j.text) msg += ` · ${j.text.slice(0, 120)}`;
      uploadErrorDetail = msg;
      if (payload) backup = { filename: savedAsName || payload.obj.filename, data: payload.obj.data };
      console.error("[VIT] DataPipe 저장 실패:", j.status, j.text);
    } else {
      uploadFailed = false; uploadErrorDetail = "";
    }
    return res;
  }

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (!isPipeSave(url)) return origFetch.apply(this, arguments);
      pending++;
      return saveWithFallback(input, init).finally(() => { pending--; });
    };
  }

  // 실패했을 때: 결과 CSV 를 이 컴퓨터로 내려받기 (엑셀에서 한글이 깨지지 않도록 BOM 포함)
  function downloadBackup() {
    if (!backup || !backup.data) return false;
    try {
      const blob = new Blob(["﻿" + backup.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = backup.filename || "backup.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch (e) { console.error("[VIT] 백업 다운로드 실패:", e); return false; }
  }

  // ── 화면 ──────────────────────────────────────────────────────────────
  const box = (inner) => `<div style="text-align:center;font-family:'Noto Sans KR','Segoe UI',sans-serif;padding:0 24px;">${inner}</div>`;
  const h1 = (t) => `<h1 id="vit-h" style="color:#1c3f94;font-size:34px;margin:0 0 14px;line-height:1.4;">${t}</h1>`;
  const sub = (t) => `<p id="vit-p" style="color:#667;font-size:20px;margin:0;">${t}</p>`;
  const btnCss = "display:inline-block;margin:6px;padding:14px 34px;background:#2554c7;color:#fff;border:0;border-radius:40px;font-weight:700;font-size:18px;text-decoration:none;cursor:pointer;";

  function target() { return document.querySelector(".jspsych-display-element") || document.body; }

  function showSoloDone() {
    const el = target();
    el.innerHTML = box(`<h1 style="color:#1c3f94;font-size:28px;margin:0 0 10px;">${T.solo1}</h1>
      <p style="color:#555;font-size:18px;margin:0 0 ${savedAsName ? 10 : 28}px;">${T.solo2}</p>
      ${savedAsName ? `<p style="color:#888;font-size:15px;margin:0 0 24px;">${T.savedAs} ${savedAsName}</p>` : ""}
      <a href="../index.html" style="${btnCss}">${T.back}</a>`);
  }

  function showFailure(headingHtml, solo, cur) {
    const el = target();
    const got = downloadBackup();
    const last = solo || cur.idx >= cur.tests.length - 1;
    el.innerHTML = box(
      h1(headingHtml) +
      `<p style="color:#c62828;font-size:20px;margin:0 0 8px;">${T.fail}</p>` +
      `<p style="color:#999;font-size:14px;margin:0 0 18px;">${uploadErrorDetail}</p>` +
      (backup ? `<p style="color:#555;font-size:17px;margin:0 0 18px;">${got ? T.backupDone : ""}</p>
        <button id="vit-backup" style="${btnCss}background:#667;">${T.backupBtn}</button>` : "") +
      (solo ? `<a href="../index.html" style="${btnCss}">${T.back}</a>`
        : last ? "" : `<button id="vit-continue" style="${btnCss}">${T.cont}</button>`));
    const b = document.getElementById("vit-backup");
    if (b) b.addEventListener("click", downloadBackup);
    const c = document.getElementById("vit-continue");
    if (c) c.addEventListener("click", () => {
      cur.idx += 1; writeQueue(cur);
      location.href = `../${cur.tests[cur.idx]}/index.html`;
    });
    if (!solo && last) writeQueue(null);
  }

  function finish() {
    const el = target();
    const cur = readQueue();
    const solo = !inQueue || !cur;   // 한 검사만 단독으로 진행한 경우

    // "저장되었습니다"라고 보여주기 전에 DataPipe 업로드 요청이 실제로 끝날 때까지 기다립니다.
    el.innerHTML = box(h1(solo ? T.solo1 : T.done) + sub(T.saving));
    const t0 = Date.now();
    const timer = setInterval(() => {
      const waited = Date.now() - t0;
      if ((waited >= MIN_SAVE_WAIT_MS && pending === 0) || waited >= MAX_SAVE_WAIT_MS) {
        clearInterval(timer);

        if (uploadFailed) {
          showFailure(solo ? T.solo1 : T.done, solo, cur);
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
          if (p) p.textContent = `${T.saved} ${savedAsName ? `${T.savedAs} ${savedAsName}. ` : ""}${T.next}`;
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
