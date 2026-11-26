/* 業務用ページの画面（計算は lpgas.js） */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var f = LPGUI.fmt;

  function render() {
    var heater = +$("heater").dataset.value;
    var factor = +$("factor").value;
    $("factor-out").textContent = factor.toFixed(2).replace(/0$/, "");
    $("heater-time").hidden = heater === 0;
    $("heater-kw").textContent = heater ? heater + "号のガス消費量の目安：" + LPG.HEATER_KW[heater] + "kW" : "給湯器を使わないときは「なし」";

    var r = LPG.biz({
      stoves: LPGUI.read($("stoves")),
      stoveKw: LPGUI.read($("stove-kw")),
      stoveHours: LPGUI.read($("stove-h")),
      heater: heater,
      heaterMin: LPGUI.read($("heater-m")),
      days: LPGUI.read($("days")),
      factor: factor
    });

    var box = $("result");
    if (!(r.total > 0)) {
      box.innerHTML = '<p class="r-empty">コンロか給湯器の使い方を入れると、ここに結果が出ます</p>';
      return;
    }
    var max = 0;
    r.items.forEach(function (it) { if (it.month > max) max = it.month; });
    box.innerHTML =
      '<p class="r-label">1か月の使用量の目安（標準）</p>' +
      '<p class="r-big"><span class="approx">約</span>' + f(r.total) + '<small>m³</small></p>' +
      '<p class="r-kg">重さにすると 約<span class="n">' + f(LPG.kg(r.total)) + "</span>kg</p>" +
      '<p class="r-range">だいたい <span class="n">' + f(r.low) + '</span> 〜 <span class="n">' + f(r.high) + "</span> m³</p>" +
      '<div class="three">' +
        three("少なめ", r.low, "") + three("標準", r.total, "mid") + three("多め", r.high, "") +
      "</div>" +
      '<ul class="breakdown">' + r.items.map(function (it) {
        var pct = Math.round(it.month / r.total * 100);
        return '<li><div class="row"><span>' + it.name + '</span><span class="v">' + f(it.month) + "<small>m³（" + pct + "%）</small></span></div>" +
          '<div class="bar"><i style="width:' + (it.month / max * 100).toFixed(1) + '%"></i></div>' +
          '<div class="note">1日 ' + f(it.perDay) + "m³ ＝ " + it.formula + "</div></li>";
      }).join("") + "</ul>";
  }
  function three(label, v, cls) {
    return '<div class="' + cls + '"><b>' + label + '</b><span class="v">' + f(v) + "<small>m³</small></span><span class=\"kg\">約" + f(LPG.kg(v)) + "kg</span></div>";
  }

  LPGUI.steppers(render);
  LPGUI.seg($("heater"), render);
  $("factor").addEventListener("input", render);
  render();
})();
