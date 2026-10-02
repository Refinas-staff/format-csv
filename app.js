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
              ${option.multiple ? "multiple" : ""}
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
            const files = Array.from(input.files || []);

            if (!files.length) {
              nameEl.textContent = "まだ選択されていません";
              return;
            }

            if (files.length === 1) {
              nameEl.textContent = files[0].name;
              return;
            }

            nameEl.innerHTML = `
              <span>選択済み：${files.length}件</span>
              <span style="display:block;margin-top:6px;line-height:1.6;">
                ${files.map(file => `・${escapeHtml(file.name)}`).join("<br>")}
              </span>
            `;
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
        const files = input && input.files ? Array.from(input.files) : [];

        if (option.required && !files.length) {
          throw new Error(`${option.label}を選択してください。`);
        }

        options[option.key] = option.multiple ? files : (files[0] || null);
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

      const selected = options[option.key];

      if (!selected) continue;

      const files = Array.isArray(selected) ? selected : [selected];

      if (!files.length) continue;

      let mergedHeaders = [];
      let mergedRows = [];

      for (const file of files) {
        const text = await readFileText(file, $("encodingSelect").value);

        const parsed = option.headerRow
          ? parseDelimitedTextWithHeaderRow(text, option.headerRow)
          : parseDelimitedTextAutoHeader(text, option.inputHeaders || []);

        const headers = parsed.headers.map(normalizeHeader);

        const requiredHeaders = option.inputHeaders || [];
        const missing = requiredHeaders.filter(header => !headers.includes(header));

        if (missing.length) {
          throw new Error(
            `${option.label}「${file.name}」に必要な列が見つかりません。\n不足: ${missing.join(", ")}\n読み取れた列: ${headers.join(", ")}`
          );
        }

        const rows = parsed.rows
          .map(row => {
            const obj = rowObject(headers, row);
            obj.__sourceFileName = file.name;
            return obj;
          })
          .filter(row => Object.values(row).some(v => String(v).trim() !== ""));

        if (!mergedHeaders.length) {
          mergedHeaders = headers;
        }

        mergedRows = mergedRows.concat(rows);
      }

      options[`${option.key}Headers`] = mergedHeaders;
      options[`${option.key}Rows`] = mergedRows;
      options[`${option.key}Files`] = files.map(file => file.name);
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
        const workbooks = customResult.workbooks || [];

        const previewSheets = workbooks.length
          ? workbooks.flatMap((workbook, workbookIndex) =>
              (workbook.sheets || []).map(sheet => ({
                ...sheet,
                previewName: `${workbook.previewLabel || workbook.fileBaseName || `Excel ${workbookIndex + 1}`}｜${sheet.name}`,
                workbookFileBaseName: workbook.fileBaseName || pattern.id
              }))
            )
          : (customResult.sheets || []);

        state.result = {
          type: "workbook",
          fileBaseName: pattern.id,
          sheets: previewSheets,
          workbooks,
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

      const workbookText = state.result.workbooks && state.result.workbooks.length
        ? `\n出力Excel数: ${state.result.workbooks.length}`
        : "";

      setStatus(
        `整形が完了しました。\nメインCSV読み込み件数: ${rows.length}件${workbookText}\nプレビューシート数: ${state.result.sheets.length}${warningText}`,
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

  function parseDelimitedTextAutoHeader(text, requiredHeaders) {
    const cleanText = text.replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(cleanText);

    const allRows = parseCsvLike(cleanText, delimiter).filter(row =>
      row.some(cell => String(cell).trim() !== "")
    );

    if (!allRows.length) {
      throw new Error("CSVが空です。");
    }

    const normalizedRequiredHeaders = (requiredHeaders || []).map(normalizeHeader);

    if (!normalizedRequiredHeaders.length) {
      throw new Error("自動検出に必要な列名が設定されていません。");
    }

    let headerIndex = -1;

    for (let i = 0; i < allRows.length; i++) {
      const candidateHeaders = allRows[i].map(normalizeHeader);

      const hitCount = normalizedRequiredHeaders.filter(header =>
        candidateHeaders.includes(header)
      ).length;

      if (hitCount >= Math.min(3, normalizedRequiredHeaders.length)) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      const sampleRows = allRows.slice(0, 8).map((row, index) => {
        return `${index + 1}行目: ${row.map(normalizeHeader).join(" / ")}`;
      }).join("\n");

      throw new Error(
        `口座CSVの列名行を自動検出できませんでした。\n必要な列: ${normalizedRequiredHeaders.join(", ")}\n\n先頭8行:\n${sampleRows}`
      );
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
      button.textContent = sheet.previewName || sheet.name;

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

    $("previewTitle").textContent = sheet.previewName || sheet.name || "プレビュー";
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

    if (style.textColor) {
      element.style.color = `#${style.textColor}`;
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
    const workbookCount = state.result && state.result.workbooks
      ? state.result.workbooks.length
      : 0;
    const hasMultipleWorkbooks = workbookCount > 1;

    $("downloadCsvButton").disabled = !hasResult;
    $("downloadExcelButton").disabled = !hasResult || hasMultipleWorkbooks;
    $("downloadExcelButton").hidden = hasMultipleWorkbooks;
    $("downloadExcelButton").textContent = "Excelをダウンロード";

    renderWorkbookDownloadButtons(hasResult);
  }

  function renderWorkbookDownloadButtons(hasResult) {
    const container = $("workbookDownloadButtons");
    if (!container) return;

    container.innerHTML = "";

    const workbookDefinitions = state.result && state.result.workbooks
      ? state.result.workbooks
      : [];

    if (workbookDefinitions.length <= 1) return;

    workbookDefinitions.forEach((workbookDefinition, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button excel";
      button.disabled = !hasResult;
      button.textContent = workbookDefinition.downloadButtonLabel
        || `${workbookDefinition.fileBaseName || `Excel ${index + 1}`}をダウンロード`;
      button.addEventListener("click", () => downloadWorkbook(index));
      container.appendChild(button);
    });
  }

  function downloadCsv() {
    const sheet = getActiveSheet();

    if (!sheet) return;

    const csv = sheet.rows.map(row => row.map(escapeCsvCell).join(",")).join("\r\n");

    const csvBaseName = sheet.workbookFileBaseName || state.result.fileBaseName || "converted";
    downloadBlob(`\uFEFF${csv}`, `${csvBaseName}_${safeSheetName(sheet.name)}.csv`, "text/csv;charset=utf-8");
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

    const workbookDefinitions = state.result.workbooks && state.result.workbooks.length
      ? state.result.workbooks
      : [
          {
            fileBaseName: state.result.fileBaseName || "converted",
            sheets: state.result.sheets
          }
        ];

    if (workbookDefinitions.length > 1) {
      return setStatus("難波システムと梅田システムのボタンから、それぞれダウンロードしてください。", "success");
    }

    downloadWorkbook(0);
  }

  async function downloadWorkbook(workbookIndex) {
    if (!state.result || !state.result.sheets.length) return;

    if (!window.XLSX) {
      return setStatus("Excel出力ライブラリを読み込めませんでした。インターネット接続またはCDNの読み込みを確認してください。", "error");
    }

    const workbookDefinitions = state.result.workbooks && state.result.workbooks.length
      ? state.result.workbooks
      : [
          {
            fileBaseName: state.result.fileBaseName || "converted",
            sheets: state.result.sheets
          }
        ];

    const workbookDefinition = workbookDefinitions[workbookIndex];
    if (!workbookDefinition) return;

    try {
      const workbook = XLSX.utils.book_new();

      (workbookDefinition.sheets || []).forEach(sheet => {
        const ws = XLSX.utils.aoa_to_sheet(sheet.rows);

        applyWorksheetStyles(ws, sheet);
        ws["!cols"] = sheet.colWidths || autoColumns(sheet.rows);

        XLSX.utils.book_append_sheet(workbook, ws, safeSheetName(sheet.name));
      });

      const fallbackName = workbookDefinitions.length > 1
        ? `${state.result.fileBaseName || "converted"}_${workbookIndex + 1}`
        : (state.result.fileBaseName || "converted");
      const dateStamp = getLocalDateStamp();
      const outputFileName = workbookDefinition.fileName
        || `${workbookDefinition.fileBaseName || fallbackName}_${dateStamp}.xlsx`;

      const hasEmbeddedCharts = (workbookDefinition.sheets || []).some(
        sheet => Array.isArray(sheet.embeddedCharts) && sheet.embeddedCharts.length
      );

      if (!hasEmbeddedCharts) {
        XLSX.writeFile(workbook, outputFileName);
        return;
      }

      if (!window.JSZip) {
        XLSX.writeFile(workbook, outputFileName);
        setStatus("Excelを作成しました。グラフシートはセルグラフで出力しています。", "success");
        return;
      }

      setStatus("Excelにヒートマップとグラフを組み込んでいます…", "");

      try {
        const rawWorkbook = XLSX.write(workbook, {
          bookType: "xlsx",
          type: "array",
          cellStyles: true
        });

        const finishedWorkbook = await embedChartImagesIntoWorkbook(
          rawWorkbook,
          workbookDefinition.sheets || []
        );

        downloadBlob(
          finishedWorkbook,
          outputFileName,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        setStatus("Excelを作成しました。ヒートマップと来館時間グラフを含めてダウンロードします。", "success");
      } catch (chartError) {
        console.warn("グラフ画像の埋め込みに失敗したため、セルグラフで出力します。", chartError);
        XLSX.writeFile(workbook, outputFileName);
        setStatus("Excelを作成しました。グラフ画像の代わりに、グラフシートのセルグラフで出力しています。", "success");
      }
    } catch (error) {
      console.error(error);
      setStatus(`Excelの作成に失敗しました。\n${error.message || error}`, "error");
    }
  }

  async function embedChartImagesIntoWorkbook(workbookBytes, sheets) {
    const zip = await JSZip.loadAsync(workbookBytes);
    let drawingNumber = 0;
    let imageNumber = 0;

    for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex++) {
      const sheet = sheets[sheetIndex];
      const charts = Array.isArray(sheet.embeddedCharts) ? sheet.embeddedCharts : [];
      if (!charts.length) continue;

      // 現在の来館分析では1シート1グラフ。複数指定された場合も順番に同じdrawingへ追加できるようにする。
      drawingNumber += 1;
      const drawingPath = `xl/drawings/drawing${drawingNumber}.xml`;
      const drawingRelsPath = `xl/drawings/_rels/drawing${drawingNumber}.xml.rels`;
      const sheetPath = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
      const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetIndex + 1}.xml.rels`;

      const sheetFile = zip.file(sheetPath);
      if (!sheetFile) throw new Error(`${sheet.name} のExcelシート情報を取得できませんでした。`);

      let sheetXml = await sheetFile.async("string");
      let sheetRelsXml = zip.file(sheetRelsPath)
        ? await zip.file(sheetRelsPath).async("string")
        : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

      const sheetRelId = nextRelationshipId(sheetRelsXml);
      sheetRelsXml = appendRelationship(
        sheetRelsXml,
        `<Relationship Id="${sheetRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingNumber}.xml"/>`
      );
      zip.file(sheetRelsPath, sheetRelsXml);

      sheetXml = ensureRelationshipNamespace(sheetXml);
      sheetXml = appendWorksheetDrawing(sheetXml, sheetRelId);
      zip.file(sheetPath, sheetXml);

      const drawingAnchors = [];
      const drawingRelationships = [];

      for (let chartIndex = 0; chartIndex < charts.length; chartIndex++) {
        const chart = charts[chartIndex];
        if (chart.type !== "lineImage") continue;

        imageNumber += 1;
        const imageBytes = await renderLineChartPng(chart);
        zip.file(`xl/media/image${imageNumber}.png`, imageBytes);

        const imageRelId = `rId${drawingRelationships.length + 1}`;
        drawingRelationships.push(
          `<Relationship Id="${imageRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${imageNumber}.png"/>`
        );
        drawingAnchors.push(buildPictureAnchorXml(chart, imageRelId, chartIndex + 2));
      }

      zip.file(drawingPath, buildDrawingXml(drawingAnchors));
      zip.file(drawingRelsPath, buildRelationshipsXml(drawingRelationships));
      await ensureDrawingContentType(zip, drawingNumber);
    }

    return zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
  }

  function nextRelationshipId(xml) {
    const ids = Array.from(String(xml).matchAll(/Id="rId(\d+)"/g)).map(match => Number(match[1]));
    return `rId${ids.length ? Math.max(...ids) + 1 : 1}`;
  }

  function appendRelationship(xml, relationshipXml) {
    return String(xml).replace(/<\/Relationships>\s*$/, `${relationshipXml}</Relationships>`);
  }

  function buildRelationshipsXml(relationships) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      relationships.join("") +
      `</Relationships>`;
  }

  function ensureRelationshipNamespace(xml) {
    if (/xmlns:r=/.test(xml)) return xml;
    return xml.replace(
      /<worksheet\b/,
      `<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`
    );
  }

  function appendWorksheetDrawing(xml, relationshipId) {
    if (/<drawing\b/.test(xml)) return xml;
    return xml.replace(/<\/worksheet>\s*$/, `<drawing r:id="${relationshipId}"/></worksheet>`);
  }

  function buildDrawingXml(anchorXmlList) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
      `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      anchorXmlList.join("") +
      `</xdr:wsDr>`;
  }

  function buildPictureAnchorXml(chart, imageRelId, shapeId) {
    const from = chart.from || { col: 3, row: 1 };
    const to = chart.to || { col: 20, row: 25 };
    const widthEmu = Math.max(1, Number(chart.width) || 1200) * 9525;
    const heightEmu = Math.max(1, Number(chart.height) || 620) * 9525;

    return `<xdr:twoCellAnchor editAs="oneCell">` +
      `<xdr:from><xdr:col>${from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
      `<xdr:to><xdr:col>${to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
      `<xdr:pic>` +
        `<xdr:nvPicPr><xdr:cNvPr id="${shapeId}" name="来館時間グラフ"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
        `<xdr:blipFill><a:blip r:embed="${imageRelId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
      `</xdr:pic>` +
      `<xdr:clientData/>` +
      `</xdr:twoCellAnchor>`;
  }

  async function ensureDrawingContentType(zip, drawingNumber) {
    const path = "[Content_Types].xml";
    const file = zip.file(path);
    if (!file) throw new Error("ExcelのContent Typesを取得できませんでした。");

    let xml = await file.async("string");
    const partName = `/xl/drawings/drawing${drawingNumber}.xml`;

    if (!xml.includes(`PartName="${partName}"`)) {
      xml = xml.replace(
        /<\/Types>\s*$/,
        `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`
      );
    }

    if (!/Extension="png"/i.test(xml)) {
      xml = xml.replace(
        /<Types([^>]*)>/,
        `<Types$1><Default Extension="png" ContentType="image/png"/>`
      );
    }

    zip.file(path, xml);
  }

  async function renderLineChartPng(chart) {
    const width = Math.max(800, Number(chart.width) || 1200);
    const height = Math.max(420, Number(chart.height) || 620);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    const labels = Array.isArray(chart.labels) ? chart.labels : [];
    const values = Array.isArray(chart.values) ? chart.values.map(value => Number(value) || 0) : [];

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);

    const margin = { left: 80, right: 34, top: 82, bottom: 92 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(1, ...values);
    const yMax = niceAxisMax(maxValue);
    const yTicks = 5;

    ctx.fillStyle = "#17201B";
    ctx.font = '700 28px Meiryo, "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.fillText(String(chart.title || "30分別来館数"), margin.left, 44);

    ctx.font = '14px Meiryo, "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.fillStyle = "#68736B";
    ctx.fillText("来館数", 18, margin.top - 18);

    ctx.strokeStyle = "#E2E8E4";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#5F6B63";
    ctx.font = '13px Meiryo, "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= yTicks; i++) {
      const value = yMax * (yTicks - i) / yTicks;
      const y = margin.top + plotHeight * i / yTicks;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(value)), margin.left - 12, y);
    }

    const pointX = index => labels.length <= 1
      ? margin.left
      : margin.left + plotWidth * index / (labels.length - 1);
    const pointY = value => margin.top + plotHeight * (1 - value / yMax);

    if (values.length) {
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = pointX(index);
        const y = pointY(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#2E7D32";
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      values.forEach((value, index) => {
        const x = pointX(index);
        const y = pointY(value);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#2E7D32";
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    ctx.fillStyle = "#5F6B63";
    ctx.font = '12px Meiryo, "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    labels.forEach((label, index) => {
      if (index % 2 !== 0 && index !== labels.length - 1) return;
      const shortLabel = String(label).split("-")[0];
      ctx.fillText(shortLabel, pointX(index), margin.top + plotHeight + 16);
    });

    if (values.length) {
      const peakValue = Math.max(...values);
      const peakIndex = values.indexOf(peakValue);
      const x = pointX(peakIndex);
      const y = pointY(peakValue);
      const label = `${labels[peakIndex] || ""}  ${peakValue}人`;

      ctx.font = '700 14px Meiryo, "Hiragino Kaku Gothic ProN", sans-serif';
      const textWidth = ctx.measureText(label).width;
      const boxWidth = textWidth + 24;
      const boxHeight = 34;
      const boxX = Math.min(Math.max(x - boxWidth / 2, margin.left), width - margin.right - boxWidth);
      const boxY = Math.max(margin.top + 6, y - 52);

      ctx.fillStyle = "#E8F5E9";
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      ctx.strokeStyle = "#81C784";
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
      ctx.fillStyle = "#1B5E20";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, boxX + boxWidth / 2, boxY + boxHeight / 2);
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(async blob => {
        if (!blob) return reject(new Error("グラフ画像を作成できませんでした。"));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, "image/png");
    });
  }

  function niceAxisMax(value) {
    const raw = Math.max(1, Number(value) || 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const normalized = raw / magnitude;
    let nice = 10;

    if (normalized <= 1) nice = 1;
    else if (normalized <= 2) nice = 2;
    else if (normalized <= 5) nice = 5;

    return nice * magnitude;
  }

  function getLocalDateStamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
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
        name: "Meiryo",
        ...(style.textColor ? { color: { rgb: style.textColor } } : {})
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
      },
      ...(style.numFmt ? { numFmt: style.numFmt } : {})
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
