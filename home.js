/* 家庭用ページの画面（計算は lpgas.js） */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var f = LPGUI.fmt;
  var num = LPGUI.read;

  // 季節の倍率の表
  ["winter", "spring", "summer", "autumn"].forEach(function (k) { $("sf-" + k).textContent = "×" + LPG.seasonFactor(k).toFixed(2); });

  function render() {
    var people = +$("people").dataset.value;
    var season = $("season").dataset.value;
    var heater = $("eq-heater").checked, stove = $("eq-stove").checked;
    var floorOn = $("eq-floor").checked, dryerOn = $("eq-dryer").checked;
    var factor = +$("factor").value;
    $("factor-out").textContent = factor.toFixed(2).replace(/0$/, "");

    // 結果に関係する入力だけ出す
    //   給湯器＋コンロ → 統計の平均だけで決まるので、コンロの時間はいらない
    //   コンロだけ → コンロを計算式で出す／給湯器だけ（IHなど）→ 平均から引くコンロ分を計算式で出す
    var needStove = stove !== heater;
    $("box-stove").hidden = !needStove;
    $("box-floor").hidden = !floorOn;
    $("box-dryer").hidden = !dryerOn;
    $("factor-fld").hidden = !(needStove || floorOn || dryerOn);

    $("people-help").textContent = people <= 2
      ? "統計は「2人以下」でまとめられているので、1人・2人は同じ平均（6.5m³）を使います。"
      : "統計の平均：" + LPG.SURVEY_BY_PEOPLE[Math.min(7, people)] + "m³／月" + (people >= 7 ? "（7人以上）" : "");
    $("stove-ttl").textContent = stove ? "コンロ（家庭用 9kW）" : "平均から引くコンロ分（家庭用 9kW）";
    $("stove-help").textContent = stove
      ? "給湯器を使わないので、コンロだけを計算式で出します。"
      : "統計の平均にはコンロ分が入っているので、ガスコンロを使ったとしたら1日何分かを入れて、その分を引きます。";
    $("season-help").textContent = season === "year"
      ? "1年を通した月平均です。"
      : LPG.SEASONS[season].name + "は、年間の月平均の ×" + LPG.seasonFactor(season).toFixed(2) + "（統計の部分に掛けます）。" + (season === "winter" ? "水温が低く、お湯を沸かすガスが増えます。" : "");

    var r = LPG.home({
      people: people, heater: heater, stove: stove, stoveMin: num($("stove-m")), factor: factor, season: season,
      floor: { on: floorOn, kw: num($("floor-kw")), hours: num($("floor-h")), days: num($("floor-d")) },
      dryer: { on: dryerOn, kw: num($("dryer-kw")), hours: num($("dryer-h")), days: num($("dryer-d")) }
    });

    var box = $("result");
    if (!r.items.length || !(r.total > 0)) {
      box.innerHTML = '<p class="r-empty">使う設備を選ぶと、ここに結果が出ます</p>';
      return;
    }
    var max = 0;
    r.items.forEach(function (it) { if (it.month > max) max = it.month; });
    box.innerHTML =
      '<p class="r-label">' + (people >= 7 ? "7人以上" : people + "人") + "・" + LPG.SEASONS[season].name + " の1か月の目安</p>" +
      '<p class="r-big"><span class="approx">約</span>' + f(r.total) + "<small>m³</small></p>" +
      '<p class="r-kg">重さにすると 約<span class="n">' + f(LPG.kg(r.total)) + "</span>kg</p>" +
      '<ul class="breakdown">' + r.items.map(function (it) {
        var pct = r.total > 0 ? Math.round(it.month / r.total * 100) : 0;
        return '<li class="' + (it.missing ? "missing" : "") + '"><div class="row"><span>' + it.name + '</span><span class="v">' +
          (it.missing ? "—" : f(it.month) + "<small>m³（" + pct + "%）</small>") + "</span></div>" +
          (it.missing ? "" : '<div class="bar"><i style="width:' + (max ? it.month / max * 100 : 0).toFixed(1) + '%"></i></div>') +
          '<div class="note">' + it.note + "</div></li>";
      }).join("") + "</ul>";
  }

  LPGUI.steppers(render);
  LPGUI.seg($("people"), render);
  LPGUI.seg($("season"), render);
  ["eq-heater", "eq-stove", "eq-floor", "eq-dryer"].forEach(function (id) { $(id).addEventListener("change", render); });
  $("factor").addEventListener("input", render);
  render();
})();
