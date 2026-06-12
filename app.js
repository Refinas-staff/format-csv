(function () {
  const state = {
    selectedPatternId: null,
    file: null,
    result: null,
    activeSheetIndex: 0
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", () => {
    renderPatternList();
    bindEvents();

    if (window.CsvToolPatterns && window.CsvToolPatterns.length) {
      selectPattern(window.CsvToolPatterns[0].id);
    }
  });

  function bindEvents() {
    $("fileInput").addEventListener("change", (event) => {
      state.file = event.target.files[0] || null;
      $("fileName").textContent = state.file ? state.file.name : "まだ選択されていません";
    });

    $("convertButton").addEventListener("click", convert);
    $("downloadCsvButton").addEventListener("click", downloadCsv);
    $("downloadExcelButton").addEventListener("click", downloadExcel);
    $("resetButton").addEventListener("click", reset);
  }

  function getPattern() {
    return window.CsvToolPatterns.find(pattern => pattern.id === state.selectedPatternId);
  }

  function renderPatternList() {
    const list = $("patternList");
    list.innerHTML = "";

    window.CsvToolPatterns.forEach(pattern => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pattern-card";
      button.dataset.patternId = pattern.id;

      button.innerHTML = `
        <div class="pattern-name">${escapeHtml(pattern.name)}</div>
        <div class="pattern-description">${escapeHtml(pattern.description)}</div>
        <div class="pattern-meta">${pattern.outputType === "excel" ? "Excel対応" : "CSV対応"}</div>
      `;

      button.addEventListener("click", () => selectPattern(pattern.id));
      list.appendChild(button);
    });
  }

  function selectPattern(patternId) {
    state.selectedPatternId = patternId;

    const pattern = getPattern();

    document.querySelectorAll(".pattern-card").forEach(card => {
      card.classList.toggle("active", card.dataset.patternId === patternId);
    });

    $("mainFileLabel").textContent = pattern && pattern.mainFileLabel
      ? pattern.mainFileLabel
      : "CSV / TSVを選択";

    renderPatternInfo();
    renderPatternOptions();

    state.result = null;
    state.activeSheetIndex = 0;

    renderEmptyPreview();
    updateDownloadButtons();
  }

  function renderPatternInfo() {
    const pattern = getPattern();
    if (!pattern) return;

    const inputItems = pattern.inputHeaders
      .map(h => `<li><code>${escapeHtml(h)}</code></li>`)
      .join("");

    const ruleItems = (pattern.rules || [])
      .map(r => `<li>${escapeHtml(r)}</li>`)
      .join("");

    $("patternInfo").innerHTML = `
      <strong>${escapeHtml(pattern.name)}</strong>
      <div style="margin-top:10px;">メインCSVの想定項目</div>
      <ul>${inputItems}</ul>
      <div style="margin-top:10px;">主なルール</div>
      <ul>${ruleItems || "<li>なし</li>"}</ul>
    `;
  }

  function renderPatternOptions() {
    const pattern = getPattern();
    const container = $("patternOptions");

    if (!container) return;

    if (!pattern || !pattern.options || pattern.options.length === 0) {
      container.innerHTML = `<div class="option-empty">この整形パターンに追加設定はありません。</div>`;
      return;
    }

    container.innerHTML = pattern.options.map(option => {
      if (option.type === "month") {
        return `
          <label class="field-label" for="option_${escapeHtml(option.key)}">${escapeHtml(option.label)}</label>
          <input
            id="option_${escapeHtml(option.key)}"
            class="option-input"
            type="month"
            data-option-key="${escapeHtml(option.key)}"
            ${option.required ? "required" : ""}
          />
          <div class="option-help">${escapeHtml(option.help || "")}</div>
        `;
      }

      if (option.type === "file") {
        return `
          <label class="field-label" for="option_${escapeHtml(option.key)}">${escapeHtml(option.label)}</label>
          <label class="file-drop" for="option_${escapeHtml(option.key)}">
            <span class="file-drop-title">${escapeHtml(option.label)}を選択</span>
            <span class="file-drop-sub" id="option_${escapeHtml(option.key)}_name">まだ選択されていません</span>
            <input
              id="option_${escapeHtml(option.key)}"
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              data-option-key="${escapeHtml(option.key)}"
            />
          </label>
          <div class="option-help">${escapeHtml(option.help || "")}</div>
        `;
      }

      return "";
    }).join("");

    pattern.options.forEach(option => {
      if (option.type === "file") {
        const input = document.querySelector(`[data-option-key="${option.key}"]`);
        const nameEl = $(`option_${option.key}_name`);

        if (input && nameEl) {
          input.addEventListener("change", () => {
            nameEl.textContent = input.files && input.files[0]
              ? input.files[0].name
              : "まだ選択されていません";
          });
        }
      }
    });
  }

  function collectPatternOptions(pattern) {
    const options = {};

    if (!pattern || !pattern.options) return options;

    for (const option of pattern.options) {
      const input = document.querySelector(`[data-option-key="${option.key}"]`);

      if (option.type === "file") {
        const file = input && input.files ? input.files[0] : null;

        if (option.required && !file) {
          throw new Error(`${option.label}を選択してください。`);
        }

        options[option.key] = file;
        continue;
      }

      const value = input ? input.value : "";

      if (option.required && !value) {
        throw new Error(`${option.label}を入力してください。`);
      }

      options[option.key] = value;
    }

    return options;
  }

  async function loadOptionFiles(pattern, options) {
    if (!pattern || !pattern.options) return;

    for (const option of pattern.options) {
      if (option.type !== "file") continue;

      const file = options[option.key];

      if (!file) continue;

      const text = await readFileText(file, $("encodingSelect").value);

      const parsed = option.headerRow
        ? parseDelimitedTextWithHeaderRow(text, option.headerRow)
        : parseDelimitedText(text);

      const headers = parsed.headers.map(normalizeHeader);

      const rows = parsed.rows
        .map(row => rowObject(headers, row))
        .filter(row => Object.values(row).some(v => String(v).trim() !== ""));

      const requiredHeaders = option.inputHeaders || [];
      const missing = requiredHeaders.filter(header => !headers.includes(header));

      if (missing.length) {
        throw new Error(
          `${option.label}に必要な列が見つかりません。\n不足: ${missing.join(", ")}\n読み取れた列: ${headers.join(", ")}`
        );
      }

      options[`${option.key}Headers`] = headers;
      options[`${option.key}Rows`] = rows;
    }
  }

  async function convert() {
    const pattern = getPattern();

    if (!pattern) {
      return setStatus("整形パターンを選択してください。", "error");
    }

    if (!state.file) {
      return setStatus("メインCSVファイルを選択してください。", "error");
    }

    try {
      setStatus("CSVを読み込んでいます…", "");

      const options = collectPatternOptions(pattern);
      await loadOptionFiles(pattern, options);

      const text = await readFileText(state.file, $("encodingSelect").value);
      const parsed = parseDelimitedText(text);

      const headers = parsed.headers.map(normalizeHeader);

      const rows = parsed.rows
        .map(row => rowObject(headers, row))
        .filter(row => Object.values(row).some(v => String(v).trim() !== ""));

      const missing = pattern.inputHeaders.filter(header => !headers.includes(header));

      if (missing.length) {
        return setStatus(
          `メインCSVに必要な列が見つかりません。\n不足: ${missing.join(", ")}\n読み取れた列: ${headers.join(", ")}`,
          "error"
        );
      }

      if (pattern.type === "row") {
        const tableRows = [pattern.outputHeaders.slice()];

        rows.forEach(row => {
          const converted = pattern.transform(row, options);
          tableRows.push(pattern.outputHeaders.map(header => converted[header] ?? ""));
        });

        state.result = {
          type: "table",
          fileBaseName: pattern.id,
          sheets: [
            {
              name: pattern.name,
              rows: tableRows,
              styleMatrix: defaultStyleMatrix(tableRows)
            }
          ]
        };
      } else if (pattern.type === "custom") {
        const customResult = pattern.transformAll(rows, options);

        state.result = {
          type: "workbook",
          fileBaseName: pattern.id,
          sheets: customResult.sheets || [],
          warnings: customResult.warnings || []
        };
      }

      if (!state.result || !state.result.sheets.length) {
        state.result = null;
        renderEmptyPreview("変換できるデータがありませんでした。");
        updateDownloadButtons();
        return setStatus("変換できるデータがありませんでした。", "error");
      }

      state.activeSheetIndex = 0;

      renderSheetTabs();
      renderPreview();
      updateDownloadButtons();

      const warningText = state.result.warnings && state.result.warnings.length
        ? `\n${state.result.warnings.join("\n")}`
        : "";

      setStatus(
        `整形が完了しました。\nメインCSV読み込み件数: ${rows.length}件\n出力シート数: ${state.result.sheets.length}${warningText}`,
        "success"
      );
    } catch (error) {
      console.error(error);
      setStatus(`エラーが発生しました。\n${error.message}`, "error");
    }
  }

  async function readFileText(file, encoding) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (encoding === "shift_jis") {
      return new TextDecoder("shift_jis").decode(bytes);
    }

    if (encoding === "utf-8") {
      return new TextDecoder("utf-8").decode(bytes);
    }

    const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const replacementCount = (utf8Text.match(/�/g) || []).length;

    if (replacementCount > 2) {
      return new TextDecoder("shift_jis").decode(bytes);
    }

    return utf8Text;
  }

  function parseDelimitedText(text) {
    const cleanText = text.replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(cleanText);

    const rows = parseCsvLike(cleanText, delimiter).filter(row =>
      row.some(cell => String(cell).trim() !== "")
    );

    if (!rows.length) {
      throw new Error("CSVが空です。");
    }

    return {
      headers: rows[0],
      rows: rows.slice(1),
      delimiter
    };
  }

  function parseDelimitedTextWithHeaderRow(text, headerRow) {
    const cleanText = text.replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(cleanText);

    const allRows = parseCsvLike(cleanText, delimiter).filter(row =>
      row.some(cell => String(cell).trim() !== "")
    );

    if (!allRows.length) {
      throw new Error("CSVが空です。");
    }

    const headerIndex = Math.max(Number(headerRow || 1) - 1, 0);

    if (!allRows[headerIndex]) {
      throw new Error(`${headerRow}行目をヘッダーとして読み込めませんでした。`);
    }

    return {
      headers: allRows[headerIndex],
      rows: allRows.slice(headerIndex + 1),
      delimiter
    };
  }

  function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/).find(line => line.trim() !== "") || "";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    return tabCount > commaCount ? "\t" : ",";
  }

  function parseCsvLike(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    if (cell !== "" || row.length) {
      row.push(cell);
      rows.push(row);
    }

    return rows;
  }

  function normalizeHeader(value) {
    return String(value || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r?\n/g, "")
      .trim();
  }

  function rowObject(headers, values) {
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = values[index] === undefined ? "" : String(values[index]).trim();
    });

    return obj;
  }

  function defaultStyleMatrix(rows) {
    return rows.map((row, rowIndex) =>
      row.map(() => rowIndex === 0 ? { fill: "E5E7EB", bold: true } : { fill: "FFFFFF" })
    );
  }

  function renderSheetTabs() {
    const tabs = $("sheetTabs");
    tabs.innerHTML = "";

    if (!state.result || state.result.sheets.length <= 1) {
      tabs.classList.remove("visible");
      return;
    }

    tabs.classList.add("visible");

    state.result.sheets.forEach((sheet, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `sheet-tab${index === state.activeSheetIndex ? " active" : ""}`;
      button.textContent = sheet.name;

      button.addEventListener("click", () => {
        state.activeSheetIndex = index;
        renderSheetTabs();
        renderPreview();
      });

      tabs.appendChild(button);
    });
  }

  function renderPreview() {
    const sheet = getActiveSheet();

    if (!sheet) {
      return renderEmptyPreview();
    }

    const area = $("previewArea");
    area.className = "preview-area";
    area.innerHTML = "";

    const table = document.createElement("table");
    table.className = "preview-table";

    const maxRows = Math.min(sheet.rows.length, 300);

    for (let r = 0; r < maxRows; r++) {
      const tr = document.createElement("tr");

      const rowNumber = document.createElement("td");
      rowNumber.className = "row-number";
      rowNumber.textContent = String(r + 1);
      tr.appendChild(rowNumber);

      sheet.rows[r].forEach((cell, c) => {
        const td = document.createElement("td");
        td.textContent = cell ?? "";
        td.contentEditable = "true";

        applyPreviewStyle(td, sheet.styleMatrix && sheet.styleMatrix[r] && sheet.styleMatrix[r][c]);

        td.addEventListener("input", () => {
          sheet.rows[r][c] = td.textContent;
        });

        tr.appendChild(td);
      });

      table.appendChild(tr);
    }

    area.appendChild(table);

    $("previewTitle").textContent = sheet.name || "プレビュー";
    $("previewBadge").textContent = `${sheet.rows.length}行`;
    $("previewNote").textContent = sheet.rows.length > maxRows
      ? `先頭${maxRows}行を表示しています。編集内容は出力に反映されます。`
      : "セルは直接編集できます。編集内容は出力に反映されます。";
  }

  function applyPreviewStyle(element, style) {
    if (!style) return;

    if (style.fill) {
      element.style.backgroundColor = `#${style.fill}`;
    }

    if (style.bold) {
      element.style.fontWeight = "900";
    }
  }

  function renderEmptyPreview(message) {
    $("sheetTabs").innerHTML = "";
    $("sheetTabs").classList.remove("visible");

    $("previewArea").className = "preview-area empty";
    $("previewArea").textContent = message || "CSVを整形すると、ここにプレビューが表示されます。";

    $("previewTitle").textContent = "プレビュー";
    $("previewBadge").textContent = "0行";
    $("previewNote").textContent = "整形後のデータがここに表示されます。セルは直接編集できます。";
  }

  function getActiveSheet() {
    return state.result && state.result.sheets[state.activeSheetIndex];
  }

  function updateDownloadButtons() {
    const hasResult = !!(state.result && state.result.sheets.length);

    $("downloadCsvButton").disabled = !hasResult;
    $("downloadExcelButton").disabled = !hasResult;
  }

  function downloadCsv() {
    const sheet = getActiveSheet();

    if (!sheet) return;

    const csv = sheet.rows.map(row => row.map(escapeCsvCell).join(",")).join("\r\n");

    downloadBlob(`\uFEFF${csv}`, `${state.result.fileBaseName || "converted"}.csv`, "text/csv;charset=utf-8");
  }

  function escapeCsvCell(value) {
    const text = String(value ?? "");

    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  }

  function downloadExcel() {
    if (!state.result || !state.result.sheets.length) return;

    if (!window.XLSX) {
      return setStatus("Excel出力ライブラリを読み込めませんでした。インターネット接続またはCDNの読み込みを確認してください。", "error");
    }

    const workbook = XLSX.utils.book_new();

    state.result.sheets.forEach(sheet => {
      const ws = XLSX.utils.aoa_to_sheet(sheet.rows);

      applyWorksheetStyles(ws, sheet);

      ws["!cols"] = autoColumns(sheet.rows);

      XLSX.utils.book_append_sheet(workbook, ws, safeSheetName(sheet.name));
    });

    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    XLSX.writeFile(workbook, `${state.result.fileBaseName || "converted"}_${dateStamp}.xlsx`);
  }

  function applyWorksheetStyles(ws, sheet) {
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c });

        if (!ws[address]) {
          ws[address] = { t: "s", v: "" };
        }

        const style = sheet.styleMatrix && sheet.styleMatrix[r] && sheet.styleMatrix[r][c]
          ? sheet.styleMatrix[r][c]
          : {};

        ws[address].s = toXlsxStyle(style);
      }
    }
  }

  function toXlsxStyle(style) {
    return {
      fill: {
        patternType: "solid",
        fgColor: { rgb: style.fill || "FFFFFF" }
      },
      font: {
        bold: !!style.bold,
        name: "Meiryo"
      },
      border: {
        top: { style: "thin", color: { rgb: "D9DEE8" } },
        right: { style: "thin", color: { rgb: "D9DEE8" } },
        bottom: { style: "thin", color: { rgb: "D9DEE8" } },
        left: { style: "thin", color: { rgb: "D9DEE8" } }
      },
      alignment: {
        vertical: "center",
        wrapText: true
      }
    };
  }

  function autoColumns(rows) {
    const maxCols = Math.max(...rows.map(row => row.length));

    return Array.from({ length: maxCols }, (_, c) => {
      const max = rows.reduce((acc, row) => Math.max(acc, String(row[c] ?? "").length), 6);
      return { wch: Math.min(Math.max(max + 2, 8), 28) };
    });
  }

  function safeSheetName(name) {
    return String(name || "Sheet")
      .replace(/[\\/?*\[\]:]/g, "_")
      .slice(0, 31) || "Sheet";
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  function reset() {
    state.file = null;
    state.result = null;
    state.activeSheetIndex = 0;

    $("fileInput").value = "";
    $("fileName").textContent = "まだ選択されていません";

    const pattern = getPattern();

    if (pattern && pattern.options) {
      pattern.options.forEach(option => {
        const input = document.querySelector(`[data-option-key="${option.key}"]`);

        if (input) {
          input.value = "";
        }

        const nameEl = $(`option_${option.key}_name`);

        if (nameEl) {
          nameEl.textContent = "まだ選択されていません";
        }
      });
    }

    setStatus("整形パターンとファイルを選択してください。", "");
    renderEmptyPreview();
    updateDownloadButtons();
  }

  function setStatus(message, type) {
    const status = $("status");

    status.textContent = message;
    status.className = `status${type ? ` ${type}` : ""}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
