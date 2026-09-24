(function () {
  const COLORS = {
    header: "D9EAF7",
    ok: "EAF7EA",
    warning: "FFF4CC",
    error: "FDE2E2",
    neutral: "F3F4F6",
    white: "FFFFFF"
  };

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\s\u3000]+/g, "")
      .trim();
  }

  function displayName(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\u3000]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const normalized = raw
      .replace(/[年月]/g, "/")
      .replace(/日/g, "")
      .replace(/-/g, "/")
      .replace(/\./g, "/");

    const match = normalized.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return null;

    return date;
  }

  function parseDateTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const normalized = raw
      .replace(/[年月]/g, "/")
      .replace(/日/g, "")
      .replace(/-/g, "/")
      .replace(/\./g, "/");

    const match = normalized.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+|T)(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || 0);

    if (hour > 23 || minute > 59 || second > 59) return null;

    const date = new Date(year, month - 1, day, hour, minute, second);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return null;

    return date;
  }

  function parseTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const match = raw.match(/(\d{1,2}):(\d{1,2})/);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 47 || minute > 59) return null;

    return hour * 60 + minute;
  }

  function dateKey(date) {
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  }

  function timeTextFromMinutes(minutes) {
    if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "";
    const normalized = Math.round(minutes);
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  }

  function timeTextFromDate(date) {
    if (!date) return "";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function signedMinutes(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return "";
    const n = Math.round(value);
    if (n > 0) return `+${n}分`;
    if (n < 0) return `${n}分`;
    return "0分";
  }

  function makeKey(date, nameKey) {
    return `${dateKey(date)}__${nameKey}`;
  }

  function uniqueJoined(values) {
    return Array.from(new Set(values.filter(Boolean))).join(" / ");
  }

  function makeStyleMatrix(rows) {
    const statusIndex = 11;
    return rows.map((row, r) => row.map((_, c) => {
      if (r === 0) return { fill: COLORS.header, bold: true };
      if (c === statusIndex) {
        const status = String(row[c] || "");
        if (status === "OK") return { fill: COLORS.ok, bold: true };
        if (status.includes("打刻") || status.includes("シフトなし")) return { fill: COLORS.error, bold: true };
        if (status.includes("遅刻") || status.includes("早退")) return { fill: COLORS.warning, bold: true };
      }
      return { fill: COLORS.white };
    }));
  }

  function safeSheetName(name, usedNames) {
    const base = String(name || "未設定")
      .replace(/[\\/?*\[\]:]/g, "_")
      .slice(0, 31) || "未設定";

    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      const tail = `_${suffix}`;
      candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
      suffix += 1;
    }
    usedNames.add(candidate);
    return candidate;
  }

  function buildComparison(shiftRows, options) {
    const attendanceRows = options.attendanceRows || [];
    const shiftMap = new Map();
    const actualMap = new Map();
    const nameDisplay = new Map();
    const warnings = [];
    let rejectedShifts = 0;
    let rejectedAttendance = 0;

    shiftRows.forEach(row => {
      const date = parseDate(row["日にち"]);
      const rawName = row["表示名"] || `${row["氏名-姓"] || ""} ${row["氏名-名"] || ""}`;
      const nameKey = normalizeName(rawName);
      const start = parseTime(row["開始時間"]);
      const end = parseTime(row["終了時間"]);

      if (!date || !nameKey || start === null || end === null) {
        rejectedShifts += 1;
        return;
      }

      const key = makeKey(date, nameKey);
      const existing = shiftMap.get(key) || {
        date,
        nameKey,
        names: [],
        stores: [],
        starts: [],
        ends: []
      };

      existing.names.push(displayName(rawName));
      existing.stores.push(String(row["グループ名"] || "").trim());
      existing.starts.push(start);
      existing.ends.push(end);
      shiftMap.set(key, existing);

      if (!nameDisplay.has(nameKey)) nameDisplay.set(nameKey, displayName(rawName));
    });

    attendanceRows.forEach(row => {
      const stampedAt = parseDateTime(row["打刻日時"]);
      const rawName = row["氏名"];
      const nameKey = normalizeName(rawName);
      const type = String(row["種別"] || "").trim();

      if (!stampedAt || !nameKey || !["出勤", "退勤"].includes(type)) {
        rejectedAttendance += 1;
        return;
      }

      const key = makeKey(stampedAt, nameKey);
      const existing = actualMap.get(key) || {
        date: new Date(stampedAt.getFullYear(), stampedAt.getMonth(), stampedAt.getDate()),
        nameKey,
        names: [],
        stores: [],
        ins: [],
        outs: []
      };

      existing.names.push(displayName(rawName));
      existing.stores.push(String(row["拠点名"] || "").trim());
      if (type === "出勤") existing.ins.push(stampedAt);
      if (type === "退勤") existing.outs.push(stampedAt);
      actualMap.set(key, existing);

      if (!nameDisplay.has(nameKey)) nameDisplay.set(nameKey, displayName(rawName));
    });

    if (rejectedShifts) warnings.push(`シフトCSVで読み取れない行が ${rejectedShifts} 件ありました。`);
    if (rejectedAttendance) warnings.push(`打刻CSVで読み取れない行が ${rejectedAttendance} 件ありました。`);

    const headers = [
      "日付", "氏名", "シフト拠点", "実績拠点",
      "シフト開始", "シフト終了", "実績出勤", "実績退勤",
      "出勤差", "退勤差", "シフト時間", "判定"
    ];

    const allKeys = Array.from(new Set([...shiftMap.keys(), ...actualMap.keys()])).sort((a, b) => {
      const [dateA, nameA] = a.split("__");
      const [dateB, nameB] = b.split("__");
      return dateA.localeCompare(dateB) || nameA.localeCompare(nameB, "ja");
    });

    const dataRows = allKeys.map(key => {
      const shift = shiftMap.get(key) || null;
      const actual = actualMap.get(key) || null;
      const source = shift || actual;
      const display = nameDisplay.get(source.nameKey) || uniqueJoined((source.names || []));

      const shiftStart = shift ? Math.min(...shift.starts) : null;
      const shiftEnd = shift ? Math.max(...shift.ends) : null;
      const firstIn = actual && actual.ins.length
        ? actual.ins.slice().sort((a, b) => a - b)[0]
        : null;
      const lastOut = actual && actual.outs.length
        ? actual.outs.slice().sort((a, b) => a - b)[actual.outs.length - 1]
        : null;

      const actualInMinutes = firstIn ? firstIn.getHours() * 60 + firstIn.getMinutes() : null;
      const actualOutMinutes = lastOut ? lastOut.getHours() * 60 + lastOut.getMinutes() : null;
      const inDiff = shiftStart !== null && actualInMinutes !== null ? actualInMinutes - shiftStart : null;
      const outDiff = shiftEnd !== null && actualOutMinutes !== null ? actualOutMinutes - shiftEnd : null;

      let status = "OK";
      if (!shift) {
        status = "シフトなし";
      } else if (!actual || (!firstIn && !lastOut)) {
        status = "打刻なし";
      } else if (!firstIn) {
        status = "出勤打刻なし";
      } else if (!lastOut) {
        status = "退勤打刻なし";
      } else {
        const states = [];
        if (inDiff > 0) states.push("遅刻");
        if (outDiff < 0) states.push("早退");
        status = states.length ? states.join("・") : "OK";
      }

      return [
        dateKey(source.date),
        display,
        shift ? uniqueJoined(shift.stores) : "",
        actual ? uniqueJoined(actual.stores) : "",
        shiftStart !== null ? timeTextFromMinutes(shiftStart) : "",
        shiftEnd !== null ? timeTextFromMinutes(shiftEnd) : "",
        timeTextFromDate(firstIn),
        timeTextFromDate(lastOut),
        signedMinutes(inDiff),
        signedMinutes(outDiff),
        shiftStart !== null && shiftEnd !== null ? timeTextFromMinutes(Math.max(0, shiftEnd - shiftStart)) : "",
        status
      ];
    });

    const allRows = [headers, ...dataRows];
    const sheets = [{
      name: "全員一覧",
      rows: allRows,
      styleMatrix: makeStyleMatrix(allRows)
    }];

    const byName = new Map();
    dataRows.forEach(row => {
      const name = row[1] || "未設定";
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(row);
    });

    const usedNames = new Set(["全員一覧"]);
    Array.from(byName.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "ja"))
      .forEach(([name, rows]) => {
        const personRows = [headers.slice(), ...rows];
        sheets.push({
          name: safeSheetName(name, usedNames),
          rows: personRows,
          styleMatrix: makeStyleMatrix(personRows)
        });
      });

    const mismatchCount = dataRows.filter(row => row[11] !== "OK").length;
    warnings.push(`照合結果: ${dataRows.length}件、要確認: ${mismatchCount}件。`);

    return { sheets, warnings };
  }

  window.CsvToolPatterns.push({
    id: "shift_actual_compare",
    name: "シフト・実績照合",
    description: "シフトCSVと打刻CSVを氏名・日付で照合し、全員一覧と個人別シートを作成します。",
    type: "custom",
    outputType: "excel",
    mainFileLabel: "シフトCSVを選択",
    inputHeaders: ["日にち", "開始時間", "終了時間", "表示名"],
    options: [
      {
        key: "attendance",
        type: "file",
        label: "打刻CSV",
        required: true,
        multiple: true,
        inputHeaders: ["打刻日時", "氏名", "種別", "拠点名"],
        help: "ログID・打刻日時・社員ID・氏名・種別・拠点名を含むCSVを選択してください。複数ファイルもまとめて読み込めます。"
      }
    ],
    rules: [
      "氏名は半角・全角スペースを除去して照合",
      "日付＋氏名でシフトと打刻を照合",
      "同じ日に複数シフトがある場合は最も早い開始〜最も遅い終了で表示",
      "実績は最初の出勤打刻と最後の退勤打刻を採用",
      "全員一覧に加えて氏名ごとの個人別シートを作成",
      "遅刻・早退・打刻なし・シフトなしを判定"
    ],
    transformAll: buildComparison
  });
})();
