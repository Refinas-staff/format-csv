(function () {
  const TIME_START_MINUTES = 9 * 60 + 30;
  const TIME_END_EXCLUSIVE = 22 * 60 + 30;
  const SLOT_MINUTES = 30;
  const WEEKDAY_ORDER = ["祝日", "火", "水", "木", "金", "土", "日"];
  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

  function parseDateTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const normalized = raw
      .replace(/[年月]/g, "/")
      .replace(/日/g, "")
      .replace(/-/g, "/")
      .replace(/\./g, "/");

    const match = normalized.match(
      /(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+|T)?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/
    );
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = match[4] === undefined ? 0 : Number(match[4]);
    const minute = match[5] === undefined ? 0 : Number(match[5]);
    const second = match[6] === undefined ? 0 : Number(match[6]);

    if (
      !year || month < 1 || month > 12 || day < 1 || day > 31 ||
      hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59
    ) return null;

    const date = new Date(year, month - 1, day, hour, minute, second, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return null;

    return date;
  }

  function dateKey(date) {
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthText(year, monthIndex) {
    return `${year}年${String(monthIndex + 1).padStart(2, "0")}月`;
  }

  function addDays(date, days) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
  }

  function startOfWeekMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function formatMonthDay(date, includeYear) {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return includeYear ? `${date.getFullYear()}/${mm}/${dd}` : `${mm}/${dd}`;
  }

  function timeText(totalMinutes) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function buildTimeSlots() {
    const slots = [];
    for (let start = TIME_START_MINUTES; start < TIME_END_EXCLUSIVE; start += SLOT_MINUTES) {
      const end = start + SLOT_MINUTES - 1;
      slots.push({
        start,
        endExclusive: start + SLOT_MINUTES,
        label: `${timeText(start)}〜${timeText(end)}`
      });
    }
    return slots;
  }

  function nthWeekdayOfMonth(year, monthIndex, weekday, nth) {
    const first = new Date(year, monthIndex, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return 1 + offset + (nth - 1) * 7;
  }

  function vernalEquinoxDay(year) {
    if (year >= 1980 && year <= 2099) {
      return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    }
    return 20;
  }

  function autumnEquinoxDay(year) {
    if (year >= 1980 && year <= 2099) {
      return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    }
    return 23;
  }

  function makeDateKey(year, monthIndex, day) {
    return dateKey(new Date(year, monthIndex, day));
  }

  function baseJapaneseHolidays(year) {
    const holidays = new Set();
    const add = (monthIndex, day) => holidays.add(makeDateKey(year, monthIndex, day));

    add(0, 1); // 元日

    if (year >= 2000) add(0, nthWeekdayOfMonth(year, 0, 1, 2));
    else add(0, 15);

    if (year >= 1967) add(1, 11); // 建国記念の日
    if (year >= 2020) add(1, 23); // 天皇誕生日

    add(2, vernalEquinoxDay(year));
    add(3, 29); // 昭和の日（旧みどりの日等を含む日付）
    add(4, 3);
    if (year >= 2007) add(4, 4);
    add(4, 5);

    if (year === 2020) {
      add(6, 23); // 海の日
      add(6, 24); // スポーツの日
      add(7, 10); // 山の日
    } else if (year === 2021) {
      add(6, 22);
      add(6, 23);
      add(7, 8);
    } else {
      if (year >= 2003) add(6, nthWeekdayOfMonth(year, 6, 1, 3));
      else if (year >= 1996) add(6, 20);
      if (year >= 2016) add(7, 11);
    }

    if (year >= 2003) add(8, nthWeekdayOfMonth(year, 8, 1, 3));
    else add(8, 15);

    add(8, autumnEquinoxDay(year));

    if (year === 2020 || year === 2021) {
      // スポーツの日は上で移動済み
    } else if (year >= 2000) {
      add(9, nthWeekdayOfMonth(year, 9, 1, 2));
    } else {
      add(9, 10);
    }

    add(10, 3);
    add(10, 23);

    if (year >= 1989 && year <= 2018) add(11, 23);

    // 皇室行事に伴う特例休日
    if (year === 2019) {
      add(3, 30);
      add(4, 1);
      add(4, 2);
      add(9, 22);
    }

    return holidays;
  }

  function japaneseHolidaySet(year) {
    const holidays = baseJapaneseHolidays(year);

    // 国民の休日：祝日に挟まれた平日を休日化（反復して確定）
    let changed = true;
    while (changed) {
      changed = false;
      const start = new Date(year, 0, 2);
      const end = new Date(year, 11, 30);
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const key = dateKey(d);
        if (holidays.has(key) || d.getDay() === 0) continue;
        const prev = dateKey(addDays(d, -1));
        const next = dateKey(addDays(d, 1));
        if (holidays.has(prev) && holidays.has(next)) {
          holidays.add(key);
          changed = true;
        }
      }
    }

    // 振替休日：日曜の祝日の直後にある最初の非祝日
    const holidayDates = Array.from(holidays)
      .map(parseDateTime)
      .filter(Boolean)
      .sort((a, b) => a - b);

    holidayDates.forEach(holiday => {
      if (holiday.getDay() !== 0) return;
      let substitute = addDays(holiday, 1);
      while (holidays.has(dateKey(substitute))) substitute = addDays(substitute, 1);
      if (substitute.getFullYear() === year) holidays.add(dateKey(substitute));
    });

    return holidays;
  }

  function isJapaneseHoliday(date, holidayCache) {
    const year = date.getFullYear();
    if (!holidayCache.has(year)) holidayCache.set(year, japaneseHolidaySet(year));
    return holidayCache.get(year).has(dateKey(date));
  }

  function weekdayCategory(date, holidayCache) {
    if (isJapaneseHoliday(date, holidayCache)) return "祝日";
    if (date.getDay() === 1) return null; // 月曜は休業日のため曜日別集計から除外
    return WEEKDAY_LABELS[date.getDay()];
  }

  function detectStoreField(rows) {
    const candidates = ["name", "kaishamei"];
    const stats = candidates.map(field => {
      const values = rows.map(row => String(row[field] || "").trim()).filter(Boolean);
      const unique = new Set(values);
      const refinasHits = values.filter(v => /リフィナス|refinas/i.test(v)).length;
      return {
        field,
        values,
        uniqueCount: unique.size,
        nonEmptyCount: values.length,
        refinasHits
      };
    }).filter(stat => stat.nonEmptyCount > 0);

    if (!stats.length) return "name";

    const keywordSorted = stats.slice().sort((a, b) => {
      const aRate = a.refinasHits / a.nonEmptyCount;
      const bRate = b.refinasHits / b.nonEmptyCount;
      return bRate - aRate || b.refinasHits - a.refinasHits;
    });
    if (keywordSorted[0].refinasHits > 0) return keywordSorted[0].field;

    const plausible = stats.filter(stat => stat.uniqueCount >= 2 && stat.uniqueCount <= 200);
    if (plausible.length) {
      plausible.sort((a, b) => a.uniqueCount - b.uniqueCount || b.nonEmptyCount - a.nonEmptyCount);
      return plausible[0].field;
    }

    return stats.find(stat => stat.field === "name")?.field || stats[0].field;
  }

  function resolveTargetMonth(rows, requestedMonth) {
    if (/^\d{4}-\d{2}$/.test(String(requestedMonth || ""))) return requestedMonth;

    const months = new Set();
    rows.forEach(row => {
      const visitDate = parseDateTime(row["raiten_hiduke"]) || parseDateTime(row["raiten_time_jst"]);
      if (visitDate) months.add(monthKey(visitDate));
    });

    if (!months.size) throw new Error("来店日付を読み取れるデータがありません。");
    if (months.size > 1) {
      throw new Error(`複数月のデータが含まれています（${Array.from(months).sort().join(", ")}）。追加設定の「対象月」を指定してください。`);
    }
    return Array.from(months)[0];
  }

  function blankCounts(slotCount) {
    return Array(slotCount).fill(0);
  }

  function addToCounts(map, key, slotIndex, slotCount) {
    if (!map.has(key)) map.set(key, { total: 0, slots: blankCounts(slotCount) });
    const target = map.get(key);
    target.total += 1;
    if (slotIndex >= 0 && slotIndex < slotCount) target.slots[slotIndex] += 1;
  }

  function getCounts(map, key, slotCount) {
    return map.get(key) || { total: 0, slots: blankCounts(slotCount) };
  }

  function styleMatrixForSummary(rows) {
    return rows.map((row, r) => row.map((_, c) => {
      const style = { fill: "FFFFFF", bold: r === 0 || r === 1 };
      if (r > 0 && c === 2) style.numFmt = "0.00";
      if (r > 0 && c === 3) style.numFmt = "0.0%";
      return style;
    }));
  }

  function heatmapFill(value, maxValue) {
    const numeric = Number(value) || 0;
    if (numeric <= 0 || maxValue <= 0) return { fill: "FFFFFF" };

    const ratio = numeric / maxValue;
    if (ratio <= 0.20) return { fill: "E8F5E9" };
    if (ratio <= 0.40) return { fill: "C8E6C9" };
    if (ratio <= 0.60) return { fill: "A5D6A7" };
    if (ratio <= 0.80) return { fill: "66BB6A" };
    return { fill: "2E7D32", textColor: "FFFFFF", bold: true };
  }

  function styleMatrixForWeekdayHeatmap(rows) {
    return rows.map((row, r) => {
      const slotValues = r > 0 ? row.slice(5).map(value => Number(value) || 0) : [];
      const rowMax = slotValues.length ? Math.max(...slotValues) : 0;

      return row.map((value, c) => {
        const style = { fill: "FFFFFF", bold: r === 0 || (r > 0 && row[0] === "全店舗合計") };
        if (r > 0 && c === 4) style.numFmt = "0.00";
        if (r > 0 && c >= 5) Object.assign(style, heatmapFill(value, rowMax));
        return style;
      });
    });
  }

  function styleMatrixForDetail(rows) {
    return rows.map((row, r) => row.map((_, c) => {
      const style = { fill: "FFFFFF", bold: r === 0 || (r > 0 && row[0] === "全店舗合計") };
      if (r > 0 && c === 4) style.numFmt = "0.00";
      return style;
    }));
  }


  function styleMatrixForTime(rows) {
    return rows.map((row, r) => row.map((_, c) => {
      const style = { fill: "FFFFFF", bold: r === 0 || r === 1 };
      if (r > 0 && c === 2) style.numFmt = "0.00";
      return style;
    }));
  }

  function buildVisitSummary(inputRows, options) {
    const slots = buildTimeSlots();
    const slotCount = slots.length;
    const targetMonth = resolveTargetMonth(inputRows, options.targetMonth);
    const [yearText, monthTextValue] = targetMonth.split("-");
    const year = Number(yearText);
    const monthIndex = Number(monthTextValue) - 1;
    const storeField = detectStoreField(inputRows);
    const holidayCache = new Map();

    const warnings = [];
    let rejected = 0;
    let outsideTimeRange = 0;

    const records = [];
    inputRows.forEach(row => {
      const arrival = parseDateTime(row["raiten_time_jst"]);
      const visitDate = parseDateTime(row["raiten_hiduke"]) || arrival;
      const store = String(row[storeField] || "").trim();

      if (!arrival || !visitDate || !store) {
        rejected += 1;
        return;
      }

      if (monthKey(visitDate) !== targetMonth) return;

      const minuteOfDay = arrival.getHours() * 60 + arrival.getMinutes();
      const slotIndex = minuteOfDay >= TIME_START_MINUTES && minuteOfDay < TIME_END_EXCLUSIVE
        ? Math.floor((minuteOfDay - TIME_START_MINUTES) / SLOT_MINUTES)
        : -1;

      if (slotIndex === -1) outsideTimeRange += 1;

      records.push({
        store,
        visitDate: new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate()),
        slotIndex
      });
    });

    if (!records.length) {
      throw new Error(`${targetMonth} に該当する来館データがありません。`);
    }

    if (rejected) warnings.push(`日付・来店時刻・店舗を読み取れない行が ${rejected} 件あり、集計対象外にしました。`);
    if (outsideTimeRange) warnings.push(`09:30〜22:29 の範囲外の来店が ${outsideTimeRange} 件あります。合計には含め、30分別の列には含めていません。`);

    const storeNames = Array.from(new Set(records.map(record => record.store))).sort();
    const entities = ["全店舗合計", ...storeNames];

    const firstDate = new Date(year, monthIndex, 1);
    const lastDate = new Date(year, monthIndex + 1, 0);
    const calendarDayCount = lastDate.getDate();

    const weekdayDayCounts = Object.fromEntries(WEEKDAY_ORDER.map(label => [label, 0]));
    let operatingDayCount = 0;
    for (let day = 1; day <= calendarDayCount; day++) {
      const date = new Date(year, monthIndex, day);
      const category = weekdayCategory(date, holidayCache);
      if (category) {
        weekdayDayCounts[category] += 1;
        operatingDayCount += 1;
      }
    }

    const weekDefinitions = [];
    let weekStart = startOfWeekMonday(firstDate);
    while (weekStart <= lastDate) {
      const weekEnd = addDays(weekStart, 6);
      const clippedStart = weekStart < firstDate ? firstDate : weekStart;
      const clippedEnd = weekEnd > lastDate ? lastDate : weekEnd;
      const dayCount = Math.floor((clippedEnd - clippedStart) / 86400000) + 1;
      const key = dateKey(weekStart);
      weekDefinitions.push({
        key,
        label: `${formatMonthDay(weekStart, true)}〜${formatMonthDay(weekEnd, false)}`,
        dayCount
      });
      weekStart = addDays(weekStart, 7);
    }

    const totalByEntity = new Map();
    const weekdayMap = new Map();
    const weekMap = new Map();
    const timeMap = new Map();

    entities.forEach(entity => {
      totalByEntity.set(entity, 0);
      timeMap.set(entity, { total: 0, slots: blankCounts(slotCount) });
      WEEKDAY_ORDER.forEach(label => weekdayMap.set(`${entity}__${label}`, { total: 0, slots: blankCounts(slotCount) }));
      weekDefinitions.forEach(week => weekMap.set(`${entity}__${week.key}`, { total: 0, slots: blankCounts(slotCount) }));
    });

    records.forEach(record => {
      const targetEntities = ["全店舗合計", record.store];
      const category = weekdayCategory(record.visitDate, holidayCache);
      const weekKey = dateKey(startOfWeekMonday(record.visitDate));

      targetEntities.forEach(entity => {
        totalByEntity.set(entity, (totalByEntity.get(entity) || 0) + 1);
        addToCounts(timeMap, entity, record.slotIndex, slotCount);
        if (category) addToCounts(weekdayMap, `${entity}__${category}`, record.slotIndex, slotCount);
        addToCounts(weekMap, `${entity}__${weekKey}`, record.slotIndex, slotCount);
      });
    });

    const grandTotal = totalByEntity.get("全店舗合計") || 0;

    const summaryRows = [["店舗", "合計", "1日平均", "構成比"]];
    entities.forEach(entity => {
      const total = totalByEntity.get(entity) || 0;
      summaryRows.push([
        entity,
        total,
        operatingDayCount ? total / operatingDayCount : 0,
        grandTotal ? total / grandTotal : 0
      ]);
    });

    const detailHeaders = [
      "店舗", "曜日", "対象日数", "合計", "1日平均",
      ...slots.map(slot => slot.label)
    ];
    const weekdayRows = [detailHeaders];
    entities.forEach(entity => {
      WEEKDAY_ORDER.forEach(label => {
        const counts = getCounts(weekdayMap, `${entity}__${label}`, slotCount);
        const days = weekdayDayCounts[label] || 0;
        weekdayRows.push([
          entity,
          label,
          days,
          counts.total,
          days ? counts.total / days : 0,
          ...counts.slots
        ]);
      });
    });

    const weekRows = [[
      "店舗", "週（月〜日）", "期間内日数", "合計", "1日平均",
      ...slots.map(slot => slot.label)
    ]];
    entities.forEach(entity => {
      weekDefinitions.forEach(week => {
        const counts = getCounts(weekMap, `${entity}__${week.key}`, slotCount);
        weekRows.push([
          entity,
          week.label,
          week.dayCount,
          counts.total,
          week.dayCount ? counts.total / week.dayCount : 0,
          ...counts.slots
        ]);
      });
    });

    const timeRows = [["店舗", "合計", "1日平均", ...slots.map(slot => slot.label)]];
    entities.forEach(entity => {
      const counts = getCounts(timeMap, entity, slotCount);
      timeRows.push([
        entity,
        counts.total,
        calendarDayCount ? counts.total / calendarDayCount : 0,
        ...counts.slots
      ]);
    });


    const sheets = [
      { name: "概要", rows: summaryRows, styleMatrix: styleMatrixForSummary(summaryRows) },
      { name: "曜日別_30分", rows: weekdayRows, styleMatrix: styleMatrixForWeekdayHeatmap(weekdayRows) },
      { name: "週別_30分", rows: weekRows, styleMatrix: styleMatrixForDetail(weekRows) },
      { name: "時間別_30分", rows: timeRows, styleMatrix: styleMatrixForTime(timeRows) }
    ];

    const baseName = `来館数集計_${monthText(year, monthIndex)}`;

    return {
      workbooks: [
        {
          fileBaseName: baseName,
          fileName: `${baseName}.xlsx`,
          previewLabel: monthText(year, monthIndex),
          sheets
        }
      ],
      warnings
    };
  }

  window.CsvToolPatterns.push({
    id: "visit_summary",
    name: "来館数集計Excel",
    description: "来店CSVから店舗別・曜日別・週別・30分別の来館数を集計し、曜日×30分をヒートマップ表示します。",
    type: "custom",
    outputType: "excel",
    mainFileLabel: "来館CSVを選択",
    inputHeaders: ["raiten_hiduke", "raiten_time_jst", "taiten_time_jst", "name", "kaishamei", "cours"],
    options: [
      {
        key: "targetMonth",
        label: "対象月（任意）",
        type: "month",
        required: false,
        help: "CSVが1か月分だけなら未指定でOKです。複数月が入っている場合は対象月を指定してください。"
      }
    ],
    rules: [
      "来店時刻は YYYY/MM/DD HH:mm:ss 形式として読み込み",
      "30分単位は 09:30〜22:29 で集計",
      "曜日別は月曜日を除外し、日本の祝日は「祝日」として集計",
      "週別は月曜〜日曜単位で、月初・月末は対象月内の日数を分母に使用",
      "概要の1日平均は曜日別の対象日数、時間別の1日平均はその月の暦日数で算出",
      "店舗名は name / kaishamei の内容から自動判定",
      "曜日別_30分は各行のピークを基準に濃淡表示するヒートマップ"
    ],
    transformAll: buildVisitSummary
  });
})();
