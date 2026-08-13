/* Hand-rolled SVG charts. No dependency, no canvas, scales with the container
   and inherits theme colors from CSS. */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function niceBounds(min, max, pad) {
    if (min === max) { min -= 1; max += 1; }
    var span = max - min;
    var p = span * (pad === undefined ? 0.12 : pad);
    return { min: min - p, max: max + p };
  }

  var Charts = {
    /* Centered moving average — smooths the day-to-day water-weight noise that
       makes raw scale readings useless for judging a trend. */
    movingAverage: function (values, window) {
      var out = [];
      for (var i = 0; i < values.length; i++) {
        var lo = Math.max(0, i - window + 1);
        var slice = values.slice(lo, i + 1);
        var sum = slice.reduce(function (a, b) { return a + b; }, 0);
        out.push(sum / slice.length);
      }
      return out;
    },

    /* points: [{date:'YYYY-MM-DD', value:Number}] oldest first. */
    lineChart: function (points, opts) {
      opts = opts || {};
      var W = 640, H = opts.height || 200;
      var padL = 38, padR = 10, padT = 12, padB = 22;
      var svg = el('svg', {
        viewBox: '0 0 ' + W + ' ' + H,
        class: 'chart',
        preserveAspectRatio: 'none',
        role: 'img',
        'aria-label': opts.label || 'chart'
      });

      if (!points.length) return svg;

      var values = points.map(function (p) { return p.value; });
      var smooth = opts.smoothWindow ? Charts.movingAverage(values, opts.smoothWindow) : null;
      var all = smooth ? values.concat(smooth) : values.slice();
      if (opts.targetValue != null) all.push(opts.targetValue);
      var b = niceBounds(Math.min.apply(null, all), Math.max.apply(null, all));

      var t0 = Store.fromKey(points[0].date).getTime();
      var t1 = Store.fromKey(points[points.length - 1].date).getTime();
      var span = Math.max(t1 - t0, 1);

      function x(dateKey) {
        return padL + (Store.fromKey(dateKey).getTime() - t0) / span * (W - padL - padR);
      }
      function y(v) {
        return padT + (b.max - v) / (b.max - b.min) * (H - padT - padB);
      }

      // horizontal gridlines + y labels
      for (var g = 0; g <= 3; g++) {
        var v = b.min + (b.max - b.min) * (g / 3);
        var yy = y(v);
        svg.appendChild(el('line', { x1: padL, y1: yy, x2: W - padR, y2: yy, class: 'grid-line' }));
        var label = el('text', { x: 4, y: yy + 3, class: 'axis-text' });
        label.textContent = Math.round(v * 10) / 10;
        svg.appendChild(label);
      }

      if (opts.targetValue != null) {
        svg.appendChild(el('line', {
          x1: padL, y1: y(opts.targetValue), x2: W - padR, y2: y(opts.targetValue), class: 'target-line'
        }));
      }

      function path(vals) {
        return points.map(function (p, i) {
          return (i ? 'L' : 'M') + x(p.date).toFixed(1) + ' ' + y(vals[i]).toFixed(1);
        }).join(' ');
      }

      if (smooth) {
        svg.appendChild(el('path', { d: path(values), class: 'series-raw' }));
        svg.appendChild(el('path', { d: path(smooth), class: 'series' }));
      } else {
        svg.appendChild(el('path', { d: path(values), class: 'series' }));
        points.forEach(function (p, i) {
          svg.appendChild(el('circle', { cx: x(p.date), cy: y(values[i]), r: 2.5, class: 'dot' }));
        });
      }

      // x labels: first and last only, to stay readable on a phone
      var first = el('text', { x: padL, y: H - 6, class: 'axis-text' });
      first.textContent = points[0].date.slice(5);
      svg.appendChild(first);
      if (points.length > 1) {
        var last = el('text', { x: W - padR, y: H - 6, class: 'axis-text', 'text-anchor': 'end' });
        last.textContent = points[points.length - 1].date.slice(5);
        svg.appendChild(last);
      }

      return svg;
    },

    /* bars: [{label, value, over:Boolean}] */
    barChart: function (bars, opts) {
      opts = opts || {};
      var W = 640, H = opts.height || 160;
      var padL = 38, padR = 10, padT = 10, padB = 24;
      var svg = el('svg', {
        viewBox: '0 0 ' + W + ' ' + H,
        class: 'chart',
        preserveAspectRatio: 'none',
        role: 'img',
        'aria-label': opts.label || 'chart'
      });
      if (!bars.length) return svg;

      var max = Math.max.apply(null, bars.map(function (b) { return b.value; }));
      if (opts.targetValue != null) max = Math.max(max, opts.targetValue);
      max = max || 1;
      var plotH = H - padT - padB;
      var slot = (W - padL - padR) / bars.length;
      var barW = Math.max(slot * 0.62, 3);

      for (var g = 0; g <= 2; g++) {
        var yy = padT + plotH * (g / 2);
        svg.appendChild(el('line', { x1: padL, y1: yy, x2: W - padR, y2: yy, class: 'grid-line' }));
        var lbl = el('text', { x: 4, y: yy + 3, class: 'axis-text' });
        lbl.textContent = Math.round(max * (1 - g / 2));
        svg.appendChild(lbl);
      }

      bars.forEach(function (bar, i) {
        var h = Math.max((bar.value / max) * plotH, bar.value > 0 ? 2 : 0);
        var cx = padL + slot * i + (slot - barW) / 2;
        svg.appendChild(el('rect', {
          x: cx.toFixed(1), y: (padT + plotH - h).toFixed(1),
          width: barW.toFixed(1), height: h.toFixed(1),
          rx: 2,
          class: 'bar-rect' + (bar.over ? ' over' : '')
        }));
        if (bar.label) {
          var t = el('text', {
            x: (cx + barW / 2).toFixed(1), y: H - 8,
            class: 'axis-text', 'text-anchor': 'middle'
          });
          t.textContent = bar.label;
          svg.appendChild(t);
        }
      });

      if (opts.targetValue != null) {
        var ty = padT + plotH - (opts.targetValue / max) * plotH;
        svg.appendChild(el('line', { x1: padL, y1: ty, x2: W - padR, y2: ty, class: 'target-line' }));
      }

      return svg;
    },

    /* Progress ring for calories consumed vs target. */
    ring: function (fraction, size, label, sub) {
      size = size || 104;
      var r = size / 2 - 8;
      var c = 2 * Math.PI * r;
      var pct = Math.max(0, Math.min(fraction, 1));
      var svg = el('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, class: 'ring' });
      svg.appendChild(el('circle', {
        cx: size / 2, cy: size / 2, r: r, fill: 'none',
        stroke: 'var(--bg-elev-2)', 'stroke-width': 9
      }));
      svg.appendChild(el('circle', {
        cx: size / 2, cy: size / 2, r: r, fill: 'none',
        stroke: fraction > 1.02 ? 'var(--danger)' : 'var(--accent)',
        'stroke-width': 9, 'stroke-linecap': 'round',
        'stroke-dasharray': (c * pct).toFixed(1) + ' ' + c.toFixed(1),
        transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'
      }));
      var t = el('text', {
        x: size / 2, y: size / 2 - 1, 'text-anchor': 'middle',
        fill: 'var(--text)', 'font-size': 20, 'font-weight': 650
      });
      t.textContent = label;
      svg.appendChild(t);
      if (sub) {
        var s = el('text', {
          x: size / 2, y: size / 2 + 15, 'text-anchor': 'middle',
          fill: 'var(--text-faint)', 'font-size': 10
        });
        s.textContent = sub;
        svg.appendChild(s);
      }
      return svg;
    }
  };

  global.Charts = Charts;
})(window);
