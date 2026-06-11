(function () {
  const COLORS = {
    topLeft: "E2F0D9",
    summary: "DDEBF7",
    stores: "FCE4EC",
    detailHeader: "D9D9D9",
    dateColumns: "F2F2F2",
    white: "FFFFFF"
  };

  const attendanceHeaders = [
    "月", "曜日", "店舗", "勤怠", "", "始業時刻", "終業時刻", "休憩", "勤務時間",
    "普通残業時間", "深夜残業時間", "休日労働時間", "休日深夜残業時間"
  ];

  const jpWeekdays = ["日", "月", "火", "水", "木", "金", "土"];

  function onlyDigits(value) {
    return String(value || "").replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)).replace(/\D/g, "");
  }

  function formatBirthdatePassword(value) {
    const digits = onlyDigits(value);
    return digits.length >= 8 ? digits.slice(0, 8) : digits;
  }

  function normalizeDateTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const normalized = raw
      .replace(/[年月]/g, "/")
      .replace(/日/g, "")
      .replace(/-/g, "/")
      .replace(/\./g, "/");

    const match = normalized.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+|T)?(\d{1,2})?:?(\d{1,2})?/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = match[4] === undefined ? 0 : Number(match[4]);
    const minute = match[5] === undefined ? 0 : Number(match[5]);

    if (!year || !month || !day || hour > 23 || minute > 59) return null;
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  function ymd(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("/");
  }

  function ymKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function timeText(date) {
    if (!date) return "";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function minutesOfDay(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function minutesToTime(minutes) {
    if (minutes === null || minutes === undefined || minutes === "" || Number.isNaN(minutes)) return "";
    const sign = minutes < 0 ? "-" : "";
    const abs = Math.abs(Math.round(minutes));
    return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
  }

  function scheduledFor(date) {
    const day = date.getDay();
    if (day === 6) return { start: 10 * 60, end: 20 * 60, breakMinutes: 60 };
    if (day === 0) return { start: 10 * 60, end: 18 * 60, breakMinutes: 60 };
    return { start: 11 * 60, end: 22 * 60, breakMinutes: 60 };
  }

  function monthDateKeys(year, monthIndex) {
    const keys = [];
    const d = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 2); // 翌月1日まで含める
    while (d < end) {
      keys.push(ymd(d));
      d.setDate(d.getDate() + 1);
    }
    return keys;
  }

  function makeAttendanceStyleMatrix(rows, storeStartColumnIndex) {
    return rows.map((row, r) => row.map((_, c) => {
      if (r <= 3 && c <= 1) return { fill: COLORS.topLeft };
      if ((r === 0 || r === 1) && c >= storeStartColumnIndex) return { fill: COLORS.stores };
      if (r <= 3 && c >= 2) return { fill: COLORS.summary };
      if (r === 4) return { fill: COLORS.detailHeader, bold: true };
      if (r >= 5 && (c === 0 || c === 1)) return { fill: COLORS.dateColumns };
      return { fill: COLORS.white };
    }));
  }

  function makeDefaultStyleMatrix(rows) {
    return rows.map((row, r) => row.map(() => r === 0 ? { fill: "E5E7EB", bold: true } : { fill: COLORS.white }));
  }

  function createAttendanceSheets(inputRows) {
    const records = [];
    const rejected = [];

    inputRows.forEach((row, index) => {
      const stampedAt = normalizeDateTime(row["打刻日時"]);
      const type = String(row["種別"] || "").trim();
      if (!stampedAt || !["出勤", "退勤"].includes(type)) {
        rejected.push({ index: index + 2, row });
        return;
      }
      records.push({
        stampedAt,
        dateKey: ymd(stampedAt),
        monthKey: ymKey(stampedAt),
        employeeId: String(row["社員ID"] || "").trim(),
        name: String(row["氏名"] || "").trim(),
        type,
        store: String(row["拠点名"] || "").trim()
      });
    });

    const employeeMonthMap = new Map();
    const allStoresByEmployeeMonth = new Map();

    records.forEach(rec => {
      const employeeKey = `${rec.employeeId}__${rec.name}`;
      const groupKey = `${employeeKey}__${rec.monthKey}`;
      if (!employeeMonthMap.has(groupKey)) employeeMonthMap.set(groupKey, []);
      employeeMonthMap.get(groupKey).push(rec);

      if (rec.type === "出勤" && rec.store) {
        if (!allStoresByEmployeeMonth.has(groupKey)) allStoresByEmployeeMonth.set(groupKey, new Set());
        allStoresByEmployeeMonth.get(groupKey).add(rec.store);
      }
    });

    const missingRows = [["社員ID", "氏名", "日付", "店舗", "内容", "始業時刻", "終業時刻"]];
    const sheets = [];

    for (const [groupKey, groupRecords] of employeeMonthMap.entries()) {
      groupRecords.sort((a, b) => a.stampedAt - b.stampedAt);
      const first = groupRecords[0];
      const [yearText, monthText] = first.monthKey.split("-");
      const year = Number(yearText);
      const monthIndex = Number(monthText) - 1;
      const stores = Array.from(allStoresByEmployeeMonth.get(groupKey) || []).sort((a, b) => a.localeCompare(b, "ja"));
      const storeStartColumnIndex = 9;
      const minColumns = Math.max(attendanceHeaders.length, storeStartColumnIndex + stores.length);

      const row1 = ["", "", "要出勤日数", "出勤日数", "欠勤日数", "遅刻日数", "早退日数", "休日出勤", "有給休暇", ...stores];
      const row2 = ["", "", "", 0, "", 0, 0, 0, 0, ...stores.map(() => 0)];
      const row3 = ["氏名", "", "勤務時間", "普通残業時間", "深夜残業時間", "休日労働時間", "休日深夜残業時間"];
      const row4 = [first.name, "", 0, 0, 0, 0, 0];
      const rows = [row1, row2, row3, row4, attendanceHeaders.slice()];
      rows.forEach(row => { while (row.length < minColumns) row.push(""); });

      const recordsByDate = new Map();
      groupRecords.forEach(rec => {
        if (!recordsByDate.has(rec.dateKey)) recordsByDate.set(rec.dateKey, []);
        recordsByDate.get(rec.dateKey).push(rec);
      });

      const storeCounts = Object.fromEntries(stores.map(store => [store, 0]));
      let attendanceDays = 0;
      let lateDays = 0;
      let earlyDays = 0;
      let totalWork = 0;
      let totalOvertime = 0;

      for (const dateKey of monthDateKeys(year, monthIndex)) {
        const d = normalizeDateTime(dateKey);
        const dailyRecords = recordsByDate.get(dateKey) || [];
        const inRecords = dailyRecords.filter(r => r.type === "出勤").sort((a, b) => a.stampedAt - b.stampedAt);
        const outRecords = dailyRecords.filter(r => r.type === "退勤").sort((a, b) => a.stampedAt - b.stampedAt);
        const firstIn = inRecords[0] || null;
        const lastOut = outRecords[outRecords.length - 1] || null;
        const store = firstIn ? firstIn.store : "";
        const schedule = scheduledFor(d);
        let breakMinutes = "";
        let workMinutes = "";
        let overtimeMinutes = "";
        let deepNightMinutes = 0;
        let holidayWorkMinutes = 0;
        let holidayDeepNightMinutes = 0;

        if (firstIn) {
          attendanceDays += 1;
          if (store && storeCounts[store] !== undefined) storeCounts[store] += 1;
          if (minutesOfDay(firstIn.stampedAt) > schedule.start) lateDays += 1;
        }

        if (lastOut && minutesOfDay(lastOut.stampedAt) < schedule.end) earlyDays += 1;

        if (firstIn && lastOut && lastOut.stampedAt > firstIn.stampedAt) {
          const spanMinutes = Math.round((lastOut.stampedAt - firstIn.stampedAt) / 60000);
          breakMinutes = spanMinutes > 360 ? 60 : 0;
          workMinutes = spanMinutes - breakMinutes;
          const scheduledWork = Math.max(0, schedule.end - schedule.start - schedule.breakMinutes);
          overtimeMinutes = Math.max(0, workMinutes - scheduledWork);
          totalWork += workMinutes;
          totalOvertime += overtimeMinutes;
        } else if (firstIn && !lastOut) {
          missingRows.push([first.employeeId, first.name, dateKey, store, "退勤漏れ", timeText(firstIn.stampedAt), ""]);
        } else if (!firstIn && lastOut) {
          missingRows.push([first.employeeId, first.name, dateKey, lastOut.store || "", "出勤漏れ", "", timeText(lastOut.stampedAt)]);
        }

        const detailRow = [
          dateKey,
          jpWeekdays[d.getDay()],
          store,
          "",
          "",
          timeText(firstIn && firstIn.stampedAt),
          timeText(lastOut && lastOut.stampedAt),
          minutesToTime(breakMinutes),
          minutesToTime(workMinutes),
          minutesToTime(overtimeMinutes),
          minutesToTime(deepNightMinutes),
          minutesToTime(holidayWorkMinutes),
          minutesToTime(holidayDeepNightMinutes)
        ];
        while (detailRow.length < minColumns) detailRow.push("");
        rows.push(detailRow);
      }

      row2[3] = attendanceDays;
      row2[5] = lateDays;
      row2[6] = earlyDays;
      row2[7] = 0;
      stores.forEach((store, index) => { row2[storeStartColumnIndex + index] = storeCounts[store] || 0; });
      row4[2] = minutesToTime(totalWork);
      row4[3] = minutesToTime(totalOvertime);
      row4[4] = "0:00";
      row4[5] = "0:00";
      row4[6] = "0:00";

      const safeName = `${first.name || first.employeeId || "未設定"}_${first.monthKey}`.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31);
      sheets.push({
        name: safeName,
        rows,
        styleMatrix: makeAttendanceStyleMatrix(rows, storeStartColumnIndex),
        meta: { employeeId: first.employeeId, name: first.name, monthKey: first.monthKey }
      });
    }

    if (missingRows.length > 1) {
      sheets.push({
        name: "打刻漏れ一覧",
        rows: missingRows,
        styleMatrix: makeDefaultStyleMatrix(missingRows)
      });
    }

    return {
      sheets,
      warnings: rejected.length ? [`読み取れない行が ${rejected.length} 件ありました。`] : []
    };
  }

  window.CsvToolPatterns = [
    {
      id: "hrmos_employee",
      name: "HRMOS社員CSV整形",
      description: "社員情報CSVをHRMOS勤怠の取込形式に整形します。",
      type: "row",
      outputType: "csv",
      inputHeaders: ["社員番号", "姓", "名", "セイ", "メイ", "生年月日", "メールアドレス", "雇用形態"],
      outputHeaders: [
        "社員ID", "ログインID", "パスワード", "社員番号", "姓", "名", "セイ", "メイ", "メールアドレス",
        "入社日", "休職日_開始_", "休職日_終了_", "退職日", "備考", "部門ID", "部門", "拠点ID", "拠点",
        "雇用形態ID", "雇用形態", "第一承認者ID", "第一承認者", "第二承認者ID", "第二承認者",
        "第三承認者ID", "第三承認者", "第四承認者ID", "第四承認者", "HRMOS勤怠メニュー", "権限ID", "権限"
      ],
      rules: [
        "ログインIDは社員番号と同じ",
        "パスワードは生年月日から数字8桁で作成",
        "正社員は雇用形態ID=1、アルバイトは雇用形態ID=2",
        "承認者・部門・拠点・備考は空欄",
        "HRMOS勤怠メニューは表示する、権限IDは5、権限は5. 一般利用者"
      ],
      transform(row) {
        const employmentType = String(row["雇用形態"] || "").trim();
        const employeeNumber = String(row["社員番号"] || "").trim();
        return {
          "社員ID": "",
          "ログインID": employeeNumber,
          "パスワード": formatBirthdatePassword(row["生年月日"]),
          "社員番号": employeeNumber,
          "姓": row["姓"] || "",
          "名": row["名"] || "",
          "セイ": row["セイ"] || "",
          "メイ": row["メイ"] || "",
          "メールアドレス": row["メールアドレス"] || "",
          "入社日": "",
          "休職日_開始_": "",
          "休職日_終了_": "",
          "退職日": "",
          "備考": "",
          "部門ID": "",
          "部門": "",
          "拠点ID": "",
          "拠点": "",
          "雇用形態ID": employmentType === "正社員" ? "1" : employmentType === "アルバイト" ? "2" : "",
          "雇用形態": employmentType,
          "第一承認者ID": "",
          "第一承認者": "",
          "第二承認者ID": "",
          "第二承認者": "",
          "第三承認者ID": "",
          "第三承認者": "",
          "第四承認者ID": "",
          "第四承認者": "",
          "HRMOS勤怠メニュー": "表示する",
          "権限ID": "5",
          "権限": "5. 一般利用者"
        };
      }
    },
    {
      id: "attendance_summary",
      name: "勤怠集計Excel整形",
      description: "打刻データから社員別・月別の勤怠表を作成します。",
      type: "custom",
      outputType: "excel",
      inputHeaders: ["打刻日時", "社員ID", "氏名", "種別", "拠点名"],
      rules: [
        "出勤打刻の拠点名を店舗として表示",
        "勤怠列は空欄",
        "出勤だけ・退勤だけの日は打刻漏れ一覧にも出力",
        "平日11:00、土日10:00より後の出勤は遅刻として自動カウント",
        "要出勤日数・欠勤日数は人と月で異なるため空欄"
      ],
      transformAll: createAttendanceSheets
    }
  ];
})();
