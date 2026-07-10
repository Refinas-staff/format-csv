(function () {
  const COLORS = {
    topLeft: "E2F0D9",
    summary: "DDEBF7",
    stores: "FCE4EC",
    detailHeader: "D9D9D9",
    dateColumns: "F2F2F2",
    header: "E5E7EB",
    white: "FFFFFF"
  };

  const jpWeekdays = ["日", "月", "火", "水", "木", "金", "土"];

  function onlyDigits(value) {
    return String(value || "")
      .replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
      .replace(/\D/g, "");
  }

  function normalizeKanaKey(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\s　\t\r\n]/g, "")
      .trim();
  }

  function formatBirthdatePassword(value) {
    const digits = onlyDigits(value);
    return digits.length >= 8 ? digits.slice(0, 8) : digits;
  }

  function splitName(value) {
    const name = String(value || "").trim().replace(/\s+/g, " ");
    if (!name) return { lastName: "", firstName: "" };

    const parts = name.split(" ");
    if (parts.length >= 2) {
      return {
        lastName: parts[0],
        firstName: parts.slice(1).join("")
      };
    }

    return {
      lastName: name,
      firstName: ""
    };
  }

  function normalizeDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const normalized = raw
      .replace(/[年月]/g, "/")
      .replace(/日/g, "")
      .replace(/-/g, "/")
      .replace(/\./g, "/");

    const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (!match) return raw;

    return [
      match[1],
      String(Number(match[2])).padStart(2, "0"),
      String(Number(match[3])).padStart(2, "0")
    ].join("/");
  }

  function monthToFirstDate(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})$/);
    if (!match) return "";
    return `${match[1]}/${match[2]}/01`;
  }

  function monthToFirstDateAfterMonths(value, addMonths) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})$/);
    if (!match) return "";

    const date = new Date(Number(match[1]), Number(match[2]) - 1 + addMonths, 1);

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      "01"
    ].join("/");
  }

  function parseFlexibleDate(value) {
    const normalized = normalizeDate(value);
    const match = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!match) return new Date(9999, 11, 31);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function sortByStoreAndRegisteredDate(rows) {
    return rows.slice().sort((a, b) => {
      const storeA = String(a["登録店舗"] || "").trim();
      const storeB = String(b["登録店舗"] || "").trim();

      const storeCompare = storeA.localeCompare(storeB, "ja");
      if (storeCompare !== 0) return storeCompare;

      return parseFlexibleDate(a["会員登録日"]) - parseFlexibleDate(b["会員登録日"]);
    });
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
    const end = new Date(year, monthIndex + 1, 2);

    while (d < end) {
      keys.push(ymd(d));
      d.setDate(d.getDate() + 1);
    }

    return keys;
  }

  function makeDefaultStyleMatrix(rows) {
    return rows.map((row, rowIndex) =>
      row.map(() => rowIndex === 0 ? { fill: COLORS.header, bold: true } : { fill: COLORS.white })
    );
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

  function createAttendanceSheets(inputRows) {
    const attendanceHeaders = [
      "月", "曜日", "店舗", "勤怠", "", "始業時刻", "終業時刻", "休憩", "勤務時間",
      "普通残業時間", "深夜残業時間", "休日労働時間", "休日深夜残業時間"
    ];

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

        if (firstIn) {
          attendanceDays += 1;
          if (store && storeCounts[store] !== undefined) storeCounts[store] += 1;
          if (minutesOfDay(firstIn.stampedAt) > schedule.start) lateDays += 1;
        }

        if (lastOut && minutesOfDay(lastOut.stampedAt) < schedule.end) {
          earlyDays += 1;
        }

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
          "0:00",
          "0:00",
          "0:00"
        ];

        while (detailRow.length < minColumns) detailRow.push("");
        rows.push(detailRow);
      }

      row2[3] = attendanceDays;
      row2[5] = lateDays;
      row2[6] = earlyDays;
      row2[7] = 0;

      stores.forEach((store, index) => {
        row2[storeStartColumnIndex + index] = storeCounts[store] || 0;
      });

      row4[2] = minutesToTime(totalWork);
      row4[3] = minutesToTime(totalOvertime);
      row4[4] = "0:00";
      row4[5] = "0:00";
      row4[6] = "0:00";

      const safeName = `${first.name || first.employeeId || "未設定"}_${first.monthKey}`
        .replace(/[\\/?*\[\]:]/g, "_")
        .slice(0, 31);

      sheets.push({
        name: safeName,
        rows,
        styleMatrix: makeAttendanceStyleMatrix(rows, storeStartColumnIndex)
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

  const buscatchInputHeaders = [
    "登録店舗",
    "名前(カナ)",
    "名前",
    "郵便番号",
    "都道府県",
    "市区町村",
    "丁目・番地",
    "電話番号",
    "メールアドレス1",
    "生年月日",
    "性別",
    "会員登録日",
    "ステータス",
    "年齢",
    "職業",
    "初回来店動機",
    "会員登録区分",
    "会員種別",
    "コース"
  ];

  const BUSCATCH_SEPARATE_STORES = new Set([
    "リフィナス大阪なんば本店",
    "リフィナス大阪心斎橋",
    "リフィナス神戸三宮"
  ]);

  function addNewCoursePrefix(value) {
    const course = String(value || "").trim();
    if (!course) return "";
    return course.startsWith("（新規）") ? course : `（新規）${course}`;
  }

  function toMembershipTypeCourse(value) {
    return String(value || "").replace(/^（新規）/, "(新規)");
  }

  const studentTemplateHeaders = [
    "*生徒名前_姓",
    "生徒名前_名",
    "生徒ふりがな_姓",
    "生徒ふりがな_名",
    "生徒番号",
    "性別\n(男,女)",
    "生年月日\n(例:2011/01/01)",
    "血液型\n(A型,B型,O型,AB型)",
    "バス利用\n(利用する,利用しない)",
    "*代表者名前_姓",
    "代表者名前_名",
    "代表者ふりがな_姓",
    "代表者ふりがな_名",
    "郵便番号",
    "*都道府県",
    "*住所1(市区町村以下)",
    "住所2(建物)",
    "自宅TEL\n(例:052-123-4567)",
    "携帯\n(例:090-123-4567)",
    "入会日\n(例:2011/01/01)",
    "保険料",
    "自由メモ",
    "自由メモ3",
    "自由メモ4",
    "自由メモ5",
    "自由メモ6",
    "自由メモ7",
    "自由メモ8",
    "自由メモ9",
    "自由メモ10",
    "携帯続柄",
    "連絡先1TEL",
    "TEL1緊急連絡先続柄",
    "申込日\n(例:2011/01/01)",
    "*入金方法\n(現金,振込,銀行,ゆうちょ)",
    "銀行名\n(入金方法が銀行の場合)",
    "銀行支店名\n(入金方法が銀行の場合)",
    "銀行 口座種別\n(入金方法が銀行の場合)",
    "銀行 口座番号\n(入金方法が銀行の場合)",
    "ゆうちょ 記号1\n(入金方法がゆうちょの場合)",
    "ゆうちょ 記号2\n(入金方法がゆうちょの場合)",
    "ゆうちょ 口座番号\n(入金方法がゆうちょの場合)",
    "口座名義\n(入金方法が銀行かゆうちょの場合)",
    "顧客番号\n(入金方法が銀行かゆうちょの場合)",
    "新規コード\n(入金方法がゆうちょの場合)",
    "取引銀行\n(入金方法が銀行かゆうちょの場合)"
  ];

  const lessonTemplateHeaders = [
    "*生徒名前_姓\n(参照のみ)",
    "*生徒名前_名\n(参照のみ)",
    "*生徒番号\n(参照のみ)",
    "*スクール",
    "*コース",
    "*級",
    "予約枠1",
    "予約枠2",
    "予約枠3",
    "予約枠4",
    "予約枠5",
    "予約枠6",
    "予約枠7",
    "*級の適用開始日\n(例:2011/01/01)",
    "*受講開始日\n(例:2011/01/01)",
    "受講終了日\n(例:2011/01/01)",
    "休止開始日\n(例:2011/01/01)",
    "休止終了日\n(例:2011/01/01)"
  ];

  const membershipTemplateHeaders = [
    "*生徒名前_姓\n(参照のみ)",
    "*生徒名前_名\n(参照のみ)",
    "*生徒番号\n(参照のみ)",
    "*受講開始日\n(参照のみ)",
    "*スクール\n(参照のみ)",
    "*コース\n(参照のみ)",
    "*会員種類",
    "*請求開始日\n例(2015/1/1)",
    "月会費\n(請求する、請求しない)",
    "月会費請求月\n(1月～12月)",
    "口座振替手数料\n(請求する、請求しない)",
    "口座振替手数料請求月\n(1月～12月)",
    "保険料\n(請求する、請求しない)",
    "保険料請求月\n(1月～12月)",
    "バス代種類",
    "ロッカー代種類",
    "ロッカーNo"
  ];

  function makeBuscatchStudentRows(rows) {
    const outputRows = [studentTemplateHeaders];

    rows.forEach(row => {
      const name = splitName(row["名前"]);
      const kana = splitName(row["名前(カナ)"]);
      const registeredDate = normalizeDate(row["会員登録日"]);

      outputRows.push([
        name.lastName,
        name.firstName,
        kana.lastName,
        kana.firstName,
        row["登録店舗"] || "",
        row["性別"] || "",
        normalizeDate(row["生年月日"]),
        "",
        "",
        name.lastName,
        name.firstName,
        kana.lastName,
        kana.firstName,
        row["郵便番号"] || "",
        row["都道府県"] || "",
        `${row["市区町村"] || ""}${row["丁目・番地"] || ""}`,
        "",
        "",
        row["電話番号"] || "",
        registeredDate,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        registeredDate,
        "銀行",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ]);
    });

    return outputRows;
  }

  function makeBuscatchLessonRows(rows, startDate) {
    const outputRows = [lessonTemplateHeaders];

    rows.forEach(row => {
      const name = splitName(row["名前"]);
      const course = addNewCoursePrefix(row["コース"]);

      outputRows.push([
        name.lastName,
        name.firstName,
        row["登録店舗"] || "",
        "キックボクシングスタジオ",
        course,
        "無",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        startDate,
        startDate,
        "",
        "",
        ""
      ]);
    });

    return outputRows;
  }

  function makeBuscatchMembershipRows(rows, startDate, billingStartDate) {
    const outputRows = [membershipTemplateHeaders];

    rows.forEach(row => {
      const name = splitName(row["名前"]);
      const course = addNewCoursePrefix(row["コース"]);

      outputRows.push([
        name.lastName,
        name.firstName,
        row["登録店舗"] || "",
        startDate,
        "キックボクシングスタジオ",
        course,
        toMembershipTypeCourse(course),
        billingStartDate,
        "請求する",
        "",
        "請求する",
        "",
        "請求しない",
        "",
        "",
        "",
        ""
      ]);
    });

    return outputRows;
  }

  function makeBuscatchWorkbookSheets(rows, startDate, billingStartDate) {
    const sortedRows = sortByStoreAndRegisteredDate(rows);
    const studentRows = makeBuscatchStudentRows(sortedRows);
    const lessonRows = makeBuscatchLessonRows(sortedRows, startDate);
    const membershipRows = makeBuscatchMembershipRows(sortedRows, startDate, billingStartDate);

    return [
      {
        name: "生徒登録テンプレート",
        rows: studentRows,
        styleMatrix: makeDefaultStyleMatrix(studentRows)
      },
      {
        name: "受講登録テンプレート",
        rows: lessonRows,
        styleMatrix: makeDefaultStyleMatrix(lessonRows)
      },
      {
        name: "会員種類登録テンプレート",
        rows: membershipRows,
        styleMatrix: makeDefaultStyleMatrix(membershipRows)
      }
    ];
  }

  function createBuscatchSheets(inputRows, options) {
    const startDate = monthToFirstDate(options.enrollmentMonth);
    const billingStartDate = monthToFirstDateAfterMonths(options.enrollmentMonth, 2);

    const separateStoreRows = inputRows.filter(row =>
      BUSCATCH_SEPARATE_STORES.has(String(row["登録店舗"] || "").trim())
    );

    const otherStoreRows = inputRows.filter(row =>
      !BUSCATCH_SEPARATE_STORES.has(String(row["登録店舗"] || "").trim())
    );

    return {
      workbooks: [
        {
          fileBaseName: "バスキャッチ登録_難波システム",
          downloadButtonLabel: "難波システムをダウンロード",
          previewLabel: "対象3店舗",
          sheets: makeBuscatchWorkbookSheets(separateStoreRows, startDate, billingStartDate)
        },
        {
          fileBaseName: "バスキャッチ登録_梅田システム",
          downloadButtonLabel: "梅田システムをダウンロード",
          previewLabel: "その他店舗",
          sheets: makeBuscatchWorkbookSheets(otherStoreRows, startDate, billingStartDate)
        }
      ],
      warnings: [
        `対象3店舗: ${separateStoreRows.length}件`,
        `その他店舗: ${otherStoreRows.length}件`
      ]
    };
  }

  const accountMatchOutputHeaders = [
    "生徒ふりがな_姓",
    "生徒ふりがな_名",
    "*入金方法\n(現金,振込,銀行,ゆうちょ)",
    "銀行名\n(入金方法が銀行の場合)",
    "銀行支店名\n(入金方法が銀行の場合)",
    "銀行 口座種別\n(入金方法が銀行の場合)",
    "銀行 口座番号\n(入金方法が銀行の場合)",
    "ゆうちょ 記号1\n(入金方法がゆうちょの場合)",
    "ゆうちょ 記号2\n(入金方法がゆうちょの場合)",
    "ゆうちょ 口座番号\n(入金方法がゆうちょの場合)",
    "口座名義\n(入金方法が銀行かゆうちょの場合)",
    "顧客番号\n(入金方法が銀行かゆうちょの場合)",
    "新規コード\n(入金方法がゆうちょの場合)",
    "取引銀行\n(入金方法が銀行かゆうちょの場合)"
  ];

  const accountCheckHeaders = [
    "元ファイル名",
    "反映結果",
    "照合キー",
    "名簿側ふりがな",
    "委託者カナ氏名",
    "取扱時刻",
    "結果",
    "銀行名",
    "支店名",
    "支店コード",
    "口座番号",
    "預金種別",
    "口座名義人",
    "取引銀行",
    "備考"
  ];

  function normalizeTransactionBankName(value) {
    const normalized = String(value || "")
      .normalize("NFKC")
      .replace(/[\s　]/g, "")
      .trim();

    if (normalized.includes("アプラス")) {
      return "アプラス";
    }

    if (normalized === "ジヤツクス") {
      return "ジャックス";
    }

    return normalized;
  }

  function cleanAccountNumber(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/^'/, "")
      .replace(/[\s　]/g, "")
      .trim();
  }

  function getPaymentType(accountNumber) {
    const num = cleanAccountNumber(accountNumber);

    if (/^\d{5}-\d{8}$/.test(num)) {
      return "ゆうちょ";
    }

    if (/^\d+$/.test(num)) {
      return "銀行";
    }

    return "現金";
  }

  function createAccountIndex(accountRows) {
    const index = new Map();

    accountRows.forEach((row, indexNumber) => {
      row.__accountRowId = `account_${indexNumber}`;
      const key = normalizeKanaKey(row["口座名義人"]);

      if (!key) return;

      if (!index.has(key)) {
        index.set(key, []);
      }

      index.get(key).push(row);
    });

    return index;
  }

function createAccountCheckRows(accountRows, accountStatusMap) {
  const rows = [accountCheckHeaders];

  accountRows.forEach(row => {
    const rowId = row.__accountRowId;
    const statusInfo = accountStatusMap.get(rowId) || {
      status: "未使用",
      rosterKana: "",
      note: "名簿側に一致するデータがありません。"
    };

    rows.push([
      row.__sourceFileName || "",
      statusInfo.status,
      normalizeKanaKey(row["口座名義人"]),
      statusInfo.rosterKana || "",
      row["委託者カナ氏名"] || "",
      row["取扱時刻"] || "",
      row["結果"] || "",
      row["銀行名"] || "",
      row["支店名"] || "",
      row["支店コード"] || "",
      cleanAccountNumber(row["口座番号"]),
      row["預金種別"] || "",
      row["口座名義人"] || "",
      normalizeTransactionBankName(row["委託者カナ氏名"]),
      statusInfo.note || ""
    ]);
  });

  return rows;
}

  function normalizeTemplateHeader(value) {
    return String(value || "")
      .replace(/\r?\n/g, "")
      .trim();
  }

  function makeCompletedStudentRow(sourceRow, accountValues) {
    const accountValueMap = new Map();

    accountMatchOutputHeaders.forEach((header, index) => {
      accountValueMap.set(normalizeTemplateHeader(header), accountValues[index] ?? "");
    });

    return studentTemplateHeaders.map(header => {
      const key = normalizeTemplateHeader(header);

      if (accountValueMap.has(key)) {
        return accountValueMap.get(key);
      }

      return sourceRow[key] ?? sourceRow[header] ?? "";
    });
  }

  function createAccountMatchSheets(rosterRows, options) {
    const accountRows = options.accountCsvRows || [];
    const accountIndex = createAccountIndex(accountRows);
    const accountStatusMap = new Map();
    const usedAccountRowIds = new Set();

    const outputRows = [accountMatchOutputHeaders];
    const completedStudentRows = [studentTemplateHeaders];

    let matchedCount = 0;
    let unmatchedCount = 0;
    let duplicateCount = 0;
    let preventedReuseCount = 0;
    let unknownAccountNumberCount = 0;

    function appendOutput(sourceRow, values) {
      outputRows.push(values);
      completedStudentRows.push(makeCompletedStudentRow(sourceRow, values));
    }

    function makeCashValues(kanaLast, kanaFirst) {
      return [
        kanaLast,
        kanaFirst,
        "現金",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ];
    }

    function addReusePreventionNote(accountRowId) {
      const current = accountStatusMap.get(accountRowId);
      if (!current) return;

      const extraNote = "同じ口座データは1回だけ使用し、2人目以降には反映していません。";
      const currentNote = current.note || "";

      accountStatusMap.set(accountRowId, {
        ...current,
        note: currentNote.includes(extraNote)
          ? currentNote
          : `${currentNote}${currentNote ? " " : ""}${extraNote}`
      });
    }

    rosterRows.forEach(row => {
      const kanaLast = row["生徒ふりがな_姓"] || "";
      const kanaFirst = row["生徒ふりがな_名"] || "";
      const rosterKana = `${kanaLast}${kanaFirst}`;
      const matchKey = normalizeKanaKey(rosterKana);
      const matches = accountIndex.get(matchKey) || [];

      if (matches.length !== 1) {
        if (matches.length > 1) {
          duplicateCount += 1;

          matches.forEach(accountRow => {
            accountStatusMap.set(accountRow.__accountRowId, {
              status: "複数一致",
              rosterKana,
              note: "同じ口座名義人が複数あるため、自動反映していません。"
            });
          });
        }

        if (matches.length === 0) unmatchedCount += 1;

        appendOutput(row, makeCashValues(kanaLast, kanaFirst));
        return;
      }

      const account = matches[0];
      const accountRowId = account.__accountRowId;

      if (usedAccountRowIds.has(accountRowId)) {
        preventedReuseCount += 1;
        addReusePreventionNote(accountRowId);
        appendOutput(row, makeCashValues(kanaLast, kanaFirst));
        return;
      }

      // 同じ口座CSV行は、この時点で最初に一致した生徒へ予約する。
      // 口座番号が不明な場合も、別の生徒へ再利用しない。
      usedAccountRowIds.add(accountRowId);

      const accountNumber = cleanAccountNumber(account["口座番号"]);
      const paymentType = getPaymentType(accountNumber);
      const bankName = account["銀行コード"] || "";
      const branchName = account["支店名"] || account["支店コード"] || "";
      const depositType = account["預金種別"] || "";
      const accountHolder = account["口座名義人"] || "";
      const customerNumber = "";
      const transactionBank = normalizeTransactionBankName(account["委託者カナ氏名"]);

      if (paymentType === "銀行") {
        matchedCount += 1;

        accountStatusMap.set(accountRowId, {
          status: "反映済み",
          rosterKana,
          note: "銀行口座として名簿に反映しました。"
        });

        appendOutput(row, [
          kanaLast,
          kanaFirst,
          "銀行",
          bankName,
          branchName,
          depositType,
          accountNumber,
          "",
          "",
          "",
          accountHolder,
          customerNumber,
          "",
          transactionBank
        ]);
        return;
      }

      if (paymentType === "ゆうちょ") {
        matchedCount += 1;

        const parts = accountNumber.split("-");

        accountStatusMap.set(accountRowId, {
          status: "反映済み",
          rosterKana,
          note: "ゆうちょ口座として名簿に反映しました。"
        });

        appendOutput(row, [
          kanaLast,
          kanaFirst,
          "ゆうちょ",
          "",
          "",
          "",
          "",
          parts[0] || "",
          "",
          parts[1] || "",
          accountHolder,
          customerNumber,
          "0",
          transactionBank
        ]);
        return;
      }

      unknownAccountNumberCount += 1;

      accountStatusMap.set(accountRowId, {
        status: "口座番号不明",
        rosterKana,
        note: "名義は一致しましたが、口座番号から銀行/ゆうちょを判定できなかったため、現金にしています。"
      });

      appendOutput(row, makeCashValues(kanaLast, kanaFirst));
    });

    const accountCheckRows = createAccountCheckRows(accountRows, accountStatusMap);

    const warnings = [
      `一致: ${matchedCount}件`,
      `未一致: ${unmatchedCount}件`,
      `複数一致: ${duplicateCount}件`,
      `重複使用防止: ${preventedReuseCount}件`,
      `口座番号不明: ${unknownAccountNumberCount}件`,
      `口座CSV読込件数: ${accountRows.length}件`
    ];

    return {
      sheets: [
        {
          name: "生徒登録テンプレート",
          rows: completedStudentRows,
          styleMatrix: makeDefaultStyleMatrix(completedStudentRows)
        },
        {
          name: "口座名義名寄せ",
          rows: outputRows,
          styleMatrix: makeDefaultStyleMatrix(outputRows)
        },
        {
          name: "口座CSV確認用",
          rows: accountCheckRows,
          styleMatrix: makeDefaultStyleMatrix(accountCheckRows)
        }
      ],
      warnings
    };
  }

  window.CsvToolPatterns = [
    {
      id: "hrmos_employee",
      name: "HRMOS社員CSV整形",
      description: "社員情報CSVをHRMOS勤怠の取込形式に整形します。",
      type: "row",
      outputType: "csv",
      mainFileLabel: "社員CSVを選択",
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
      mainFileLabel: "打刻CSVを選択",
      inputHeaders: ["打刻日時", "社員ID", "氏名", "種別", "拠点名"],
      rules: [
        "出勤打刻の拠点名を店舗として表示",
        "勤怠列は空欄",
        "出勤だけ・退勤だけの日は打刻漏れ一覧にも出力",
        "平日11:00、土日10:00より後の出勤は遅刻として自動カウント",
        "要出勤日数・欠勤日数は人と月で異なるため空欄"
      ],
      transformAll: createAttendanceSheets
    },
    {
      id: "buscatch_basic",
      name: "バスキャッチ登録-基本データ",
      description: "基本データを対象3店舗とその他店舗に分け、各Excelに3テンプレートを作成します。",
      type: "custom",
      outputType: "excel",
      mainFileLabel: "アプリから出力したデータを選択",
      inputHeaders: buscatchInputHeaders,
      options: [
        {
          key: "enrollmentMonth",
          label: "入会手続き月",
          type: "month",
          required: true,
          help: "受講開始日・級の適用開始日に月初を使用し、請求開始日は翌々月の月初にします。"
        }
      ],
      rules: [
        "2つのExcelを同時出力：対象3店舗、その他店舗",
        "対象3店舗：リフィナス大阪なんば本店、リフィナス大阪心斎橋、リフィナス神戸三宮",
        "各Excelは3シート構成：生徒登録テンプレート、受講登録テンプレート、会員種類登録テンプレート",
        "登録店舗ごとにまとめ、同じ店舗内では会員登録日順に並べます",
        "全テンプレートの生徒番号には、一旦「登録店舗」を入れます",
        "受講登録：コースの先頭に（新規）を付け、スクールはキックボクシングスタジオ、級は無",
        "会員種類登録：コースは受講登録と同じ全角の（新規）、会員種類だけ半角の(新規)を付けます",
        "会員種類登録：請求開始日は入会手続き月の翌々月",
        "生徒登録：入会日・申込日は元CSVの会員登録日"
      ],
      transformAll: createBuscatchSheets
    },
    {
      id: "account_name_match",
      name: "口座名義 名寄せ",
      description: "生徒登録テンプレートと複数の口座CSVを照合し、口座情報を反映したテンプレートと確認用シートを出力します。",
      type: "custom",
      outputType: "excel",
      mainFileLabel: "生徒登録テンプレートを選択",
      inputHeaders: ["生徒ふりがな_姓", "生徒ふりがな_名"],
      options: [
        {
          key: "accountCsv",
          label: "口座CSV",
          type: "file",
          required: true,
          multiple: true,
          help: "複数選択できます。口座CSVの中から列名行を自動検出します。口座名義人で照合します。",
          inputHeaders: [
            "委託者カナ氏名",
            "銀行コード",
            "銀行名",
            "口座番号",
            "預金種別",
            "口座名義人"
          ]
        }
      ],
      rules: [
        "口座CSVは複数ファイルを選択できます",
        "選択した複数の口座CSVをまとめて照合します",
        "Excelで3シート出力します：生徒登録テンプレート、口座名義名寄せ、口座CSV確認用",
        "入力した生徒登録テンプレートの口座関連列へ、名寄せ結果を反映して出力します",
        "同じ口座CSV行は最初に一致した1名だけに反映し、2人目以降は現金にします",
        "口座CSV確認用には、元ファイル名・反映結果・備考を出力します",
        "反映結果は、反映済み・未使用・複数一致・口座番号不明です",
        "名簿側は「生徒ふりがな_姓 + 生徒ふりがな_名」で照合します",
        "口座CSV側は「口座名義人」のみで照合します",
        "照合時は全角・半角スペースを削除し、半角カナは全角カナに寄せます",
        "口座番号が数字のみの場合は銀行",
        "口座番号が 12200-08871351 のような形式の場合はゆうちょ",
        "ゆうちょはハイフン前5桁を記号1、後ろ8桁を口座番号にします",
        "ゆうちょの場合、新規コードは0にします",
        "銀行支店名には、支店名があれば支店名、なければ支店コードを入れます",
        "顧客番号は空欄にします",
        "取引銀行には委託者カナ氏名を使用し、ｱﾌﾟﾗｽ・ｶ)ｱﾌﾟﾗｽ はアプラス、ジヤツクスはジャックスに変換します",
        "未一致・複数一致・口座番号不明は現金にします"
      ],
      transformAll: createAccountMatchSheets
    }
  ];
})();
