(function () {
  const COLORS = { header: "E5E7EB", white: "FFFFFF" };

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

  function makeDefaultStyleMatrix(rows) {
    return rows.map((row, rowIndex) =>
      row.map(() => rowIndex === 0 ? { fill: COLORS.header, bold: true } : { fill: COLORS.white })
    );
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
        row["性別"] === "男性" ? "男" : row["性別"] === "女性" ? "女" : (row["性別"] || ""),
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
        row["メールアドレス1"] || "",
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
      const course = addNewCoursePrefix(row["コース"]).replace(/（特別）/g, "");

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


  window.CsvToolPatterns.push({
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
  });
})();
