(function () {
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

  window.CsvToolPatterns.push({
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
  });
})();
