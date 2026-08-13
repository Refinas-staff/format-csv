(function () {
  const COLORS = { header: "E5E7EB", white: "FFFFFF" };

  function normalizeKanaKey(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\s　\t\r\n]/g, "")
      .trim();
  }

  function makeDefaultStyleMatrix(rows) {
    return rows.map((row, rowIndex) =>
      row.map(() => rowIndex === 0 ? { fill: COLORS.header, bold: true } : { fill: COLORS.white })
    );
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


  function normalizeComparisonText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\s　]/g, "")
      .trim();
  }

  function isSuccessfulResult(value) {
    return String(value || "").trim() === "○";
  }

  function sameApprovedAccountDetails(rows) {
    if (!rows.length) return false;

    const first = rows[0];
    const firstAccountNumber = cleanAccountNumber(first["口座番号"]);
    const firstBankName = normalizeComparisonText(first["銀行名"]);
    const firstAccountHolder = normalizeKanaKey(first["口座名義人"]);

    return rows.every(row =>
      cleanAccountNumber(row["口座番号"]) === firstAccountNumber &&
      normalizeComparisonText(row["銀行名"]) === firstBankName &&
      normalizeKanaKey(row["口座名義人"]) === firstAccountHolder
    );
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
      let account = null;
      let duplicateApprovedNote = "";

      if (matches.length === 0) {
        unmatchedCount += 1;
        appendOutput(row, makeCashValues(kanaLast, kanaFirst));
        return;
      }

      if (matches.length > 1) {
        duplicateCount += 1;

        matches.forEach(accountRow => {
          accountStatusMap.set(accountRow.__accountRowId, {
            status: "複数一致",
            rosterKana,
            note: "同じ口座名義人が複数あるため、自動反映していません。"
          });
        });

        const approvedMatches = matches.filter(accountRow => isSuccessfulResult(accountRow["結果"]));

        if (approvedMatches.length === 1) {
          account = approvedMatches[0];
        } else if (approvedMatches.length > 1) {
          if (sameApprovedAccountDetails(approvedMatches)) {
            duplicateApprovedNote = "口座CSVに2件以上存在するものの、反映可能なものがあったので反映しました。";

            approvedMatches.forEach(accountRow => {
              accountStatusMap.set(accountRow.__accountRowId, {
                status: "複数一致",
                rosterKana,
                note: duplicateApprovedNote
              });
            });

            account = approvedMatches[0];
          } else {
            const note = "同じ口座名義人が口座CSVに2件以上存在するものの、口座内容が違うので、登録を見送りました。";

            matches.forEach(accountRow => {
              accountStatusMap.set(accountRow.__accountRowId, {
                status: "複数一致",
                rosterKana,
                note
              });
            });

            appendOutput(row, makeCashValues(kanaLast, kanaFirst));
            return;
          }
        } else {
          appendOutput(row, makeCashValues(kanaLast, kanaFirst));
          return;
        }
      } else {
        account = matches[0];
      }

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
          note: duplicateApprovedNote || "銀行口座として名簿に反映しました。"
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
          note: duplicateApprovedNote || "ゆうちょ口座として名簿に反映しました。"
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

  window.CsvToolPatterns.push({
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
          "口座名義人",
          "結果"
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
      "同じ口座名義人が複数ある場合は、結果が○の行を優先します",
      "結果が○の行が複数ある場合、口座番号・銀行名・口座名義人がすべて同じなら反映します",
      "結果が○の行が複数あり、口座番号・銀行名・口座名義人のいずれかが異なる場合は登録を見送ります",
      "口座番号が数字のみの場合は銀行",
      "口座番号が 12200-08871351 のような形式の場合はゆうちょ",
      "ゆうちょはハイフン前5桁を記号1、後ろ8桁を口座番号にします",
      "ゆうちょの場合、新規コードは0にします",
      "銀行支店名には、支店名があれば支店名、なければ支店コードを入れます",
      "顧客番号は空欄にします",
      "取引銀行には委託者カナ氏名を使用し、ｱﾌﾟﾗｽ・ｶ)ｱﾌﾟﾗｽ はアプラス、ジヤツクスはジャックスに変換します",
      "未一致・反映できない複数一致・口座番号不明は現金にします"
    ],
    transformAll: createAccountMatchSheets
  });
})();
