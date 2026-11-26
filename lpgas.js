/* ============================================================
   プロパンガス使用量の目安：計算の部分（業務用・家庭用で共通）
   画面には関係しないので、このファイルだけで計算を確かめられます。
   ============================================================ */
var LPG = (function () {
  "use strict";

  /* ---------- 換算のきまり ---------- */
  // プロパン 1m³ ≈ 24,000 kcal、1kW ＝ 860 kcal/h とする（持ち主の指定）
  // → 1m³ ≈ 24,000 ÷ 860 ≈ 27.9 kWh
  var KWH_PER_M3 = 27.9;

  // 重さ（kg）への換算：プロパンの産気率 0.502 m³/kg（1m³ ＝ 1.99kg）
  // 出典：日本LPガス協会「プロパン、ブタン、ＬＰガスの立方メートルからキログラムへの換算係数について」
  //       （省エネ法・温対法のための換算係数。全国平均気温14.9℃から4℃引いた温度、
  //        大気圧 0.1013MPa＋0.0028MPa で算出）
  //       掲載先：https://www.pref.yamanashi.jp/documents/60408/lpgas_guidline_keisuu.pdf
  //       （2026-11-26 に本文を確認。novalis 秘密ページの初期値 0.502 m³/kg とも同じ）
  var M3_PER_KG = 0.502;

  // 機器のガス消費量の目安（kW）。持ち主の指定。銘板・仕様書の値を優先すること
  var HEATER_KW = { 16: 34.9, 20: 43.6, 24: 52.3, 32: 69.2 };
  var HOME_STOVE_KW = 9;

  /* ---------- 家庭用の統計 ---------- */
  // 家族人数別 1世帯当たり月平均使用量（m³／世帯）
  // 出典：石油情報センター「平成18年度 プロパンガス消費実態調査」（平成19年12月）p.10
  //       調査期間 平成18年4月〜平成19年3月、プロパンガス使用 5,610世帯を分析
  //       https://oil-info.ieej.or.jp/documents/data/20080303_2.pdf
  //       （これより新しい公的な人数別の統計は、2026-11-26 時点で見つからなかった）
  var SURVEY_BY_PEOPLE = { 2: 6.5, 3: 8.9, 4: 11.3, 5: 11.7, 6: 12.0, 7: 11.8 };   // 2 は「2人以下」、7 は「7人以上」

  // 全国の月別 1世帯当たり使用量（m³／月／世帯）。同じ調査の付属資料 p.24〜25「全国」の行
  //   4月 10.5, 5月 9.4, 6月 8.2, 7月 7.0, 8月 6.4, 9月 6.3,
  //   10月 7.7, 11月 9.0, 12月 10.5, 1月 12.2, 2月 11.7, 3月 10.8（年度計 109.5 → 月平均 9.1）
  var MONTHLY = { 1: 12.2, 2: 11.7, 3: 10.8, 4: 10.5, 5: 9.4, 6: 8.2, 7: 7.0, 8: 6.4, 9: 6.3, 10: 7.7, 11: 9.0, 12: 10.5 };
  var YEAR_AVG = 109.5 / 12;
  // 季節ごとの倍率 ＝ その3か月の平均 ÷ 年間の月平均
  var SEASONS = {
    year:   { name: "年間の平均",      months: [] },
    winter: { name: "冬（12〜2月）",  months: [12, 1, 2] },
    spring: { name: "春（3〜5月）",   months: [3, 4, 5] },
    summer: { name: "夏（6〜8月）",   months: [6, 7, 8] },
    autumn: { name: "秋（9〜11月）",  months: [9, 10, 11] }
  };
  function seasonFactor(key) {
    var s = SEASONS[key];
    if (!s || !s.months.length) return 1;
    var sum = 0;
    s.months.forEach(function (m) { sum += MONTHLY[m]; });
    return sum / s.months.length / YEAR_AVG;
  }
  function surveyAvg(people) { return SURVEY_BY_PEOPLE[Math.min(7, Math.max(2, people))]; }

  /* ---------- 基本の式 ---------- */
  // 使用量（m³）＝ ガス消費量（kW）÷ 27.9 × 使用時間（時間）
  function m3(kw, hours) { return kw / KWH_PER_M3 * hours; }
  function kg(v) { return v / M3_PER_KG; }
  function r1(x) { return Math.round(x * 10) / 10; }   // 小数第1位まで

  /*
   * 業務用
   * o = { stoves:台数, stoveKw:1台のkW, stoveHours:1台の1日の時間, heater:号数(0=使わない), heaterMin:1日のお湯の分数, days:営業日数, factor:火力係数 }
   * 火力係数はコンロにかける。給湯器は「実際にお湯を出している時間」を入れるのでかけない。
   * 少なめ・多めは、標準の ±25%（使い方のばらつき）。
   */
  var SPREAD = 0.25;
  function biz(o) {
    var items = [];
    if (o.stoves > 0 && o.stoveKw > 0 && o.stoveHours > 0) {
      items.push({ key: "stove", name: "コンロ（" + o.stoves + "台）",
        perDay: m3(o.stoveKw * o.stoves, o.stoveHours) * o.factor,
        formula: o.stoveKw + "kW × " + o.stoves + "台 ÷ 27.9 × " + o.stoveHours + "時間 × 火力係数" + o.factor });
    }
    if (o.heater && HEATER_KW[o.heater] && o.heaterMin > 0) {
      items.push({ key: "heater", name: "給湯器（" + o.heater + "号）",
        perDay: m3(HEATER_KW[o.heater], o.heaterMin / 60),
        formula: HEATER_KW[o.heater] + "kW ÷ 27.9 × " + o.heaterMin + "分" });
    }
    var total = 0;
    items.forEach(function (it) { it.month = it.perDay * o.days; total += it.month; });
    return { items: items, total: total, low: total * (1 - SPREAD), high: total * (1 + SPREAD), perDay: o.days ? total / o.days : 0 };
  }

  /*
   * 家庭用
   * o = { people, heater:bool, stove:bool, stoveMin:コンロの1日の分数, factor:火力係数,
   *       floor:{on,kw,hours,days}, dryer:{on,kw,hours,days}, season }
   * ・給湯器を使う家：統計の平均（給湯とコンロを使う一般的な家庭）× 季節の倍率
   *   コンロを使わない（IHなど）なら、そこから計算式のコンロ分を引く
   * ・給湯器を使わない家：統計は使えないので、コンロだけを計算式で出す
   * ・床暖房・浴室乾燥機：銘板の kW × 時間 × 火力係数 × 使う日数 を足す
   */
  function home(o) {
    var items = [];
    var sf = seasonFactor(o.season);
    var stoveMonth = m3(HOME_STOVE_KW, (o.stoveMin || 0) / 60) * o.factor * 30;
    if (o.heater) {
      var base = surveyAvg(o.people) * sf;
      if (o.stove) {
        items.push({ key: "base", name: "給湯・コンロ", note: "統計の平均" + (o.season !== "year" ? "×季節" : ""), month: base });
      } else {
        items.push({ key: "base", name: "給湯", note: "統計の平均からコンロ分を引いた値", month: Math.max(0, base - stoveMonth) });
      }
    } else if (o.stove) {
      items.push({ key: "stove", name: "コンロ", note: HOME_STOVE_KW + "kW・1日" + o.stoveMin + "分・火力係数" + o.factor + "・30日", month: stoveMonth });
    }
    [["floor", "床暖房"], ["dryer", "浴室乾燥機"]].forEach(function (d) {
      var e = o[d[0]];
      if (!e || !e.on) return;
      var ok = e.kw > 0 && e.hours > 0 && e.days > 0;
      items.push({ key: d[0], name: d[1], note: ok ? e.kw + "kW・1日" + e.hours + "時間・火力係数" + o.factor + "・" + e.days + "日" : "銘板のkWを入れると足します",
        month: ok ? m3(e.kw, e.hours) * o.factor * e.days : 0, missing: !ok });
    });
    var total = 0;
    items.forEach(function (it) { total += it.month; });
    return { items: items, total: total, seasonFactor: sf, survey: surveyAvg(o.people) };
  }

  return {
    KWH_PER_M3: KWH_PER_M3, M3_PER_KG: M3_PER_KG, HEATER_KW: HEATER_KW, HOME_STOVE_KW: HOME_STOVE_KW,
    SURVEY_BY_PEOPLE: SURVEY_BY_PEOPLE, SEASONS: SEASONS, seasonFactor: seasonFactor,
    m3: m3, kg: kg, r1: r1, biz: biz, home: home
  };
})();

/* ---------- 画面で共通に使う道具（数字の入力欄の −／＋ など） ---------- */
var LPGUI = (function () {
  "use strict";
  function fmt(x) { return LPG.r1(x).toFixed(1); }

  // <div class="stepper" data-min data-max data-step> の − ＋ ボタン
  function steppers(onChange) {
    [].forEach.call(document.querySelectorAll(".stepper"), function (box) {
      var input = box.querySelector("input");
      var min = +box.dataset.min, max = +box.dataset.max, step = +box.dataset.step;
      function clamp(v) { return Math.min(max, Math.max(min, Math.round(v / step) * step)); }
      function set(v) { input.value = String(+clamp(v).toFixed(2)); onChange(); }
      box.querySelector(".minus").addEventListener("click", function () { set(read(input) - step); });
      box.querySelector(".plus").addEventListener("click", function () { set(read(input) + step); });
      input.addEventListener("input", onChange);
      input.addEventListener("blur", function () { if (input.value !== "") set(read(input)); });
    });
  }
  // 全角数字もOK。読めなければ 0
  function read(input) {
    var s = String(input.value || "").replace(/[０-９．]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[^\d.]/g, "");
    var v = parseFloat(s);
    return isFinite(v) ? v : 0;
  }
  function seg(el, onChange) {
    function paint(v) { [].forEach.call(el.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === v)); }); }
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      el.dataset.value = b.dataset.v; paint(b.dataset.v); onChange();
    });
    paint(el.dataset.value);
  }
  return { fmt: fmt, steppers: steppers, read: read, seg: seg };
})();
