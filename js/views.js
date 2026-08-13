/* View rendering. Plain DOM construction — no framework, no build step.
   Each view returns a DocumentFragment that app.js drops into <main>. */
(function (global) {
  'use strict';

  /* ---------- tiny DOM helper ---------- */

  function h(tag, attrs, children) {
    var parts = tag.split('.');
    var node = document.createElement(parts[0] || 'div');
    if (parts.length > 1) node.className = parts.slice(1).join(' ');

    // Second argument is attributes only when it's a plain object; anything
    // else (string, number, array, Node) is children.
    if (attrs != null && (typeof attrs !== 'object' || Array.isArray(attrs) || attrs instanceof Node)) {
      children = attrs;
      attrs = null;
    }
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') node.className += (node.className ? ' ' : '') + v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
      else if (k in node && k !== 'list' && k !== 'type') node[k] = v;
      else node.setAttribute(k, v);
    });
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children == null || children === false) return;
    if (Array.isArray(children)) { children.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
  }

  function frag(children) {
    var f = document.createDocumentFragment();
    append(f, children);
    return f;
  }

  function stat(label, value, note, cls) {
    return h('div.stat', [
      h('div.stat-label', label),
      h('div.stat-value' + (cls ? '.' + cls : ''), value),
      note ? h('div.stat-note', note) : null
    ]);
  }

  function macroBar(label, value, target, cls) {
    var pct = target ? Math.min(value / target, 1) * 100 : 0;
    var over = target && value > target * 1.02;
    return h('div.bar-row', [
      h('div.bar-head', [
        h('span', label),
        h('b', Math.round(value) + ' / ' + Math.round(target) + 'g')
      ]),
      h('div.bar' + (cls ? '.' + cls : '') + (over ? '.over' : ''), [
        h('i', { style: 'width:' + pct.toFixed(1) + '%' })
      ])
    ]);
  }

  function dateNav(dateKey, onChange) {
    return h('div.row.spread', { style: 'margin-bottom:14px' }, [
      h('button.btn.ghost.sm', { onclick: function () { onChange(Store.addDays(dateKey, -1)); } }, '‹'),
      h('strong', Store.prettyDate(dateKey)),
      h('button.btn.ghost.sm', {
        onclick: function () { onChange(Store.addDays(dateKey, 1)); },
        disabled: dateKey >= Store.today()
      }, '›')
    ]);
  }

  /* ---------- dashboard ---------- */

  function dashboard(ctx) {
    var date = ctx.date;
    var entries = Store.foodFor(date);
    var totals = Nutrition.totals(entries);
    var t = Nutrition.currentTargets();
    var remaining = t.kcal - totals.kcal;
    var latest = Store.latestWeight();

    var todaysWorkouts = Store.get().workouts.filter(function (w) { return w.date === date; });
    var advice = Coach.advice().slice(0, 2);

    return frag([
      dateNav(date, ctx.setDate),

      h('div.card', [
        h('div.ring-wrap', [
          Charts.ring(t.kcal ? totals.kcal / t.kcal : 0, 112,
            String(Math.round(totals.kcal)), 'of ' + t.kcal),
          h('div', { style: 'flex:1;min-width:0' }, [
            h('div', { style: 'margin-bottom:10px' }, [
              h('div.stat-label', remaining >= 0 ? 'Remaining' : 'Over budget'),
              h('div.stat-value' + (remaining < 0 ? '.bad' : ''),
                [Math.abs(Math.round(remaining)), h('small', ' kcal')])
            ]),
            macroBar('Protein', totals.protein, t.protein, 'p'),
            macroBar('Carbs', totals.carbs, t.carbs, 'c'),
            macroBar('Fat', totals.fat, t.fat, 'f')
          ])
        ]),
        h('div.row.mt', [
          h('button.btn', { onclick: function () { ctx.go('food'); } }, '+ Log food'),
          h('button.btn.ghost', { onclick: function () { ctx.go('train'); } }, '+ Log workout')
        ])
      ]),

      h('div.card', [
        h('div.card-head', [
          h('h2.card-title', 'Weight'),
          h('button.btn.ghost.sm', { onclick: ctx.promptWeight }, latest ? 'Log weigh-in' : 'Add first weigh-in')
        ]),
        latest
          ? h('div.grid-3', [
              stat('Latest', latest.lbs + ' lb', Store.prettyDate(latest.date)),
              (function () {
                var tr = Coach.weightTrend(21);
                return stat('Trend', tr ? (tr.perWeek > 0 ? '+' : '') + tr.perWeek.toFixed(2) : '—',
                  tr ? 'lb / week' : 'need ~10 days');
              })(),
              stat('Goal', Store.get().profile.goalWeight ? Store.get().profile.goalWeight + ' lb' : '—',
                (function () {
                  var p = Coach.projection();
                  return p ? '~' + p.weeks + ' wks out' : 'set in settings';
                })())
            ])
          : h('p.empty', 'No weigh-ins yet. Morning, after the bathroom, before food.')
      ]),

      h('div.card', [
        h('div.card-head', [
          h('h2.card-title', 'Training today'),
          h('button.btn.ghost.sm', { onclick: function () { ctx.go('train'); } }, 'Open')
        ]),
        todaysWorkouts.length
          ? h('ul.list', todaysWorkouts.map(function (w) {
              return h('li', [
                h('div.item-main', [
                  h('div.item-name', w.name || 'Workout'),
                  h('div.item-sub', (w.exercises || []).length + ' exercises · ' +
                    Workouts.workoutVolume(w).toLocaleString() + ' lb volume')
                ]),
                h('button.btn.ghost.sm', { onclick: function () { ctx.openWorkout(w.id); } }, 'Edit')
              ]);
            }))
          : h('p.empty', 'Nothing logged today.')
      ]),

      advice.length ? h('div.card', [
        h('div.card-head', [
          h('h2.card-title', 'Coach says'),
          h('button.btn.ghost.sm', { onclick: function () { ctx.go('coach'); } }, 'More')
        ]),
        advice.map(adviceRow)
      ]) : null
    ]);
  }

  function adviceRow(a) {
    return h('div.advice', [
      h('div.advice-icon', a.icon),
      h('div.advice-body', [
        h('p.advice-title', a.title),
        h('p.advice-text', a.text)
      ])
    ]);
  }

  /* ---------- food ---------- */

  function food(ctx) {
    var date = ctx.date;
    var entries = Store.foodFor(date);
    var totals = Nutrition.totals(entries);
    var t = Nutrition.currentTargets();

    var resultsBox = h('div');
    var searchInput = h('input', {
      type: 'search',
      placeholder: 'Search foods — "chicken", "rice", "beer"…',
      oninput: function () { renderResults(this.value); }
    });

    function renderResults(q) {
      resultsBox.innerHTML = '';
      var list = Foods.search(q, 30);
      if (!q.trim()) return;
      if (!list.length) {
        resultsBox.appendChild(h('p.empty', [
          'No match. ',
          h('button.linklike', { onclick: function () { ctx.promptCustomFood(q); } }, 'Create "' + q + '"')
        ]));
        return;
      }
      resultsBox.appendChild(h('div.results', list.map(function (f) {
        return h('div.result', {
          onclick: function () { ctx.promptQuantity(f, date); }
        }, [
          h('div', [
            h('div.result-name', f.name),
            h('div.result-macros', f.kcal + ' kcal · ' + f.p + 'p ' + f.c + 'c ' + f.f + 'f per ' +
              f.serving + ' ' + f.unit)
          ]),
          h('span.faint', '+')
        ]);
      })));
    }

    var frequent = Foods.frequent(8);

    return frag([
      dateNav(date, ctx.setDate),

      h('div.card', [
        h('div.row.spread', { style: 'margin-bottom:12px' }, [
          h('div', [
            h('div.stat-label', 'Consumed'),
            h('div.stat-value', [Math.round(totals.kcal), h('small', ' / ' + t.kcal + ' kcal')])
          ]),
          h('div', { style: 'text-align:right' }, [
            h('div.stat-label', 'Protein'),
            h('div.stat-value' + (totals.protein >= t.protein ? '.good' : ''),
              [Math.round(totals.protein), h('small', ' / ' + t.protein + 'g')])
          ])
        ]),
        h('div.bar' + (totals.kcal > t.kcal * 1.02 ? '.over' : ''), [
          h('i', { style: 'width:' + Math.min(100, t.kcal ? totals.kcal / t.kcal * 100 : 0).toFixed(1) + '%' })
        ])
      ]),

      h('div.card', [
        h('div.card-head', [
          h('h2.card-title', 'Add food'),
          h('button.btn.ghost.sm', { onclick: function () { ctx.promptCustomFood(''); } }, 'Custom')
        ]),
        searchInput,
        frequent.length ? h('div.row.row-wrap', { style: 'margin-top:10px;gap:6px' },
          frequent.map(function (f) {
            return h('span.chip', {
              onclick: function () { ctx.promptQuantity(f, date); }
            }, f.name.split(',')[0]);
          })) : null,
        resultsBox,
        h('div.hint', 'Log the thing you are least proud of first. An incomplete log is worse than no log — it makes the math lie to you.')
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'Logged — ' + Store.prettyDate(date)),
        entries.length
          ? h('ul.list', entries.map(function (e, i) {
              return h('li', [
                h('div.item-main', [
                  h('div.item-name', e.name),
                  h('div.item-sub', e.qty + ' ' + e.unit + ' · ' + e.p + 'p ' + e.c + 'c ' + e.f + 'f')
                ]),
                h('span.item-kcal', e.kcal),
                h('button.x-btn', {
                  title: 'Remove',
                  onclick: function () { Store.removeFood(date, i); ctx.rerender(); }
                }, '✕')
              ]);
            }))
          : h('p.empty', 'Nothing logged for this day.')
      ])
    ]);
  }

  /* ---------- training ---------- */

  function train(ctx) {
    if (ctx.draft) return workoutEditor(ctx);

    var recent = Store.workoutsSorted().slice(0, 8);
    var activeId = Store.get().activeProgram;
    var active = Workouts.program(activeId);

    return frag([
      h('div.card', [
        h('div.card-head', [
          h('h2.card-title', 'Start a session'),
          h('button.btn.sm', { onclick: function () { ctx.startBlankWorkout(); } }, 'Blank workout')
        ]),
        active
          ? h('div', [
              h('p.card-sub', { style: 'margin-bottom:10px' }, active.name),
              h('div.grid-2', active.days.map(function (d, i) {
                return h('button.btn.ghost.sm', {
                  style: 'text-align:left',
                  onclick: function () { ctx.startFromTemplate(active.id, i); }
                }, d.name);
              }))
            ])
          : h('p.empty', 'No program selected — pick one below, or log a blank session.')
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'Programs'),
        Workouts.PROGRAMS.map(function (p) {
          var on = p.id === activeId;
          return h('div', { style: 'padding:10px 0;border-bottom:1px solid var(--line)' }, [
            h('div.row.spread', [
              h('strong', p.name),
              h('button.btn.sm' + (on ? '' : '.ghost'), {
                onclick: function () {
                  Store.update(function (s) { s.activeProgram = on ? null : p.id; });
                  ctx.rerender();
                }
              }, on ? 'Active' : 'Use')
            ]),
            h('p.card-sub', { style: 'margin-top:4px' }, p.blurb)
          ]);
        })
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'Recent sessions'),
        recent.length
          ? h('ul.list', recent.map(function (w) {
              return h('li', [
                h('div.item-main', [
                  h('div.item-name', w.name || 'Workout'),
                  h('div.item-sub', Store.prettyDate(w.date) + ' · ' +
                    (w.exercises || []).length + ' exercises · ' +
                    Workouts.workoutVolume(w).toLocaleString() + ' lb')
                ]),
                h('button.btn.ghost.sm', { onclick: function () { ctx.openWorkout(w.id); } }, 'Open'),
                h('button.x-btn', {
                  onclick: function () {
                    ctx.confirm('Delete this session?',
                      (w.name || 'This workout') + ' from ' + Store.prettyDate(w.date) + ' will be removed.',
                      'Delete',
                      function () { Store.deleteWorkout(w.id); ctx.rerender(); });
                  }
                }, '✕')
              ]);
            }))
          : h('p.empty', 'No sessions logged yet.')
      ])
    ]);
  }

  function workoutEditor(ctx) {
    var w = ctx.draft;
    var volumeNode = h('span.mono', Workouts.workoutVolume(w).toLocaleString() + ' lb');

    function refreshVolume() {
      volumeNode.textContent = Workouts.workoutVolume(w).toLocaleString() + ' lb';
    }

    function exerciseCard(ex, exIndex) {
      var meta = Workouts.find(ex.name);
      var best = Workouts.bestE1rm(ex.name, w.id);
      var last = Workouts.lastPerformance(ex.name, w.id);
      var setsBox = h('div');

      function setRow(set, i) {
        var prNode = h('span.pr', '');

        /* The right-hand column doubles as live feedback: estimated 1RM for the
           set you just typed, or a star when it beats your best ever. */
        function checkPr() {
          var e = Workouts.e1rm(Number(set.weight), Number(set.reps));
          var isPr = e > 0 && best > 0 && e > best;
          prNode.textContent = isPr ? '★' : (e ? String(e) : '');
          prNode.title = e ? 'est. 1RM ' + e + ' lb' : '';
          prNode.className = 'pr' + (isPr ? ' good' : ' faint tiny');
        }
        checkPr();

        return h('div.set-row', [
          h('span.idx', i + 1),
          h('input', {
            type: 'number', inputmode: 'decimal', placeholder: 'lb', value: set.weight,
            oninput: function () { set.weight = this.value; checkPr(); refreshVolume(); ctx.autosave(); }
          }),
          h('input', {
            type: 'number', inputmode: 'numeric', placeholder: 'reps', value: set.reps,
            oninput: function () { set.reps = this.value; checkPr(); refreshVolume(); ctx.autosave(); }
          }),
          prNode,
          h('button.x-btn', {
            onclick: function () {
              ex.sets.splice(i, 1);
              renderSets(); refreshVolume(); ctx.autosave();
            }
          }, '✕')
        ]);
      }

      function renderSets() {
        setsBox.innerHTML = '';
        ex.sets.forEach(function (s, i) { setsBox.appendChild(setRow(s, i)); });
      }
      renderSets();

      return h('div.exercise', [
        h('div.exercise-head', [
          h('div', [
            h('div.exercise-name', ex.name),
            h('div.item-sub', [
              meta ? meta.muscle : '',
              ex.target ? ' · target ' + ex.target : '',
              best ? ' · best e1RM ' + best + ' lb' : ''
            ].join(''))
          ]),
          h('button.x-btn', {
            onclick: function () {
              w.exercises.splice(exIndex, 1);
              ctx.autosave(); ctx.rerender();
            }
          }, '✕')
        ]),
        last ? h('div.item-sub', { style: 'margin-bottom:6px' },
          'Last (' + Store.prettyDate(last.date) + '): ' +
          last.sets.filter(function (s) { return s.reps; })
                   .map(function (s) { return s.weight + '×' + s.reps; }).join(', ')) : null,
        setsBox,
        h('div.row', [
          h('button.btn.ghost.sm', {
            onclick: function () {
              var prev = ex.sets[ex.sets.length - 1] || { weight: '', reps: '' };
              ex.sets.push({ weight: prev.weight, reps: '' });
              renderSets(); ctx.autosave();
            }
          }, '+ Set')
        ]),
        ex.note ? h('div.hint', ex.note) : null
      ]);
    }

    return frag([
      h('div.card', [
        h('div.card-head', [
          h('h2.card-title', 'Logging session'),
          h('div.row', [
            h('button.btn.ghost.sm', { onclick: ctx.closeWorkout }, 'Done')
          ])
        ]),
        h('div.grid-2', [
          h('label.field', [h('span', 'Name'), h('input', {
            value: w.name,
            oninput: function () { w.name = this.value; ctx.autosave(); }
          })]),
          h('label.field', [h('span', 'Date'), h('input', {
            type: 'date', value: w.date,
            onchange: function () { w.date = this.value; ctx.autosave(); }
          })])
        ]),
        h('div.row.spread.mt', [
          h('span.item-sub', 'Session volume'),
          volumeNode
        ])
      ]),

      h('div.card', [
        w.exercises.length
          ? w.exercises.map(exerciseCard)
          : h('p.empty', 'No exercises yet.'),
        h('button.btn.ghost', {
          style: 'width:100%;margin-top:6px',
          onclick: ctx.promptAddExercise
        }, '+ Add exercise')
      ]),

      h('div.card', [
        h('label.field', [h('span', 'Session notes'), h('textarea', {
          rows: 3, value: w.notes || '',
          placeholder: 'Sleep, energy, aches, what felt heavy…',
          oninput: function () { w.notes = this.value; ctx.autosave(); }
        })]),
        h('div.hint', 'Progressive overload is the whole game: beat last session by one rep or 5 lbs on at least one set. The ★ marks a set that beat your best estimated 1RM for that lift.')
      ])
    ]);
  }

  /* ---------- progress ---------- */

  function goalLineIfNear(weights, goal) {
    if (!goal || weights.length < 2) return null;
    var vals = weights.map(function (w) { return w.lbs; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var span = Math.max(hi - lo, 1);
    if (goal > hi + span || goal < lo - span) return null;
    return goal;
  }

  function progress(ctx) {
    var weights = Store.sortedWeights();
    var trend = Coach.weightTrend(28) || Coach.weightTrend(90);
    var vols = Workouts.volumeByWeek(8);
    var profile = Store.get().profile;

    var weightCard = h('div.card', [
      h('div.card-head', [
        h('h2.card-title', 'Bodyweight'),
        h('button.btn.ghost.sm', { onclick: ctx.promptWeight }, '+ Weigh-in')
      ]),
      weights.length >= 2
        ? frag([
            Charts.lineChart(weights.map(function (p) { return { date: p.date, value: p.lbs }; }), {
              smoothWindow: 7,
              // Only draw the goal line once it is close enough that including
              // it doesn't flatten the trend into a horizontal smear.
              targetValue: goalLineIfNear(weights, profile.goalWeight),
              label: 'bodyweight over time'
            }),
            h('p.tiny.faint', { style: 'margin:6px 0 0' },
              'Dotted = daily readings. Solid = 7-day average. Judge progress by the solid line only.')
          ])
        : h('p.empty', 'Log at least two weigh-ins to see the trend.'),
      weights.length ? h('div.grid-3.mt', [
        stat('Start', (profile.startWeight || weights[0].lbs) + ' lb'),
        stat('Now', weights[weights.length - 1].lbs + ' lb'),
        stat('Change',
          (function () {
            var d = weights[weights.length - 1].lbs - (profile.startWeight || weights[0].lbs);
            return (d > 0 ? '+' : '') + d.toFixed(1) + ' lb';
          })())
      ]) : null
    ]);

    var measured = Coach.measuredTdee(21);

    return frag([
      weightCard,

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'Rate of change'),
        h('div.grid-3', [
          stat('21-day trend', trend ? (trend.perWeek > 0 ? '+' : '') + trend.perWeek.toFixed(2) : '—', 'lb / week'),
          stat('Target rate',
            ((Nutrition.GOALS[profile.goal] || {}).sign > 0 ? '+' : '-') +
            Math.abs(profile.rateLbsPerWeek || 0).toFixed(2), 'lb / week'),
          stat('Measured TDEE', measured ? measured.tdee : '—',
            measured ? measured.loggedDays + ' logged days' : 'need 10+ days')
        ])
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'Training volume — last 8 weeks'),
        vols.some(function (v) { return v.volume > 0; })
          ? frag([
              Charts.barChart(vols.map(function (v, i) {
                return { label: i % 2 === 0 ? v.end.slice(5) : '', value: v.volume };
              }), { label: 'weekly training volume' }),
              h('p.tiny.faint', { style: 'margin:6px 0 0' },
                'Total tonnage (weight × reps). Rising over months is the clearest sign the program is working.')
            ])
          : h('p.empty', 'No training logged yet.')
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'Weekly sets per muscle (last 14 days ÷ 2)'),
        (function () {
          var sets = Workouts.weeklySetsByMuscle(Store.addDays(Store.today(), -13));
          var any = Workouts.MUSCLES.some(function (m) { return sets[m] > 0; });
          if (!any) return h('p.empty', 'No training logged yet.');
          return h('div', Workouts.MUSCLES.map(function (m) {
            var perWeek = sets[m] / 2;
            var pct = Math.min(perWeek / Workouts.WEEKLY_SET_TARGET.max, 1) * 100;
            return h('div.bar-row', [
              h('div.bar-head', [
                h('span', m),
                h('b', perWeek.toFixed(1) + ' sets')
              ]),
              h('div.bar', [h('i', { style: 'width:' + pct.toFixed(1) + '%' })])
            ]);
          }));
        })(),
        h('div.hint', '10-20 hard sets per muscle per week is the productive range. Sets where a muscle assists count as half.')
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'Estimated 1RM — main lifts'),
        (function () {
          var lifts = ['Barbell Back Squat', 'Barbell Bench Press', 'Trap Bar Deadlift',
                       'Conventional Deadlift', 'Overhead Press', 'Barbell Row', 'Pull-up'];
          var rows = lifts.map(function (l) {
            return { name: l, best: Workouts.bestE1rm(l) };
          }).filter(function (r) { return r.best > 0; });
          if (!rows.length) return h('p.empty', 'Log some sets to see estimated maxes.');
          return h('ul.list', rows.map(function (r) {
            return h('li', [
              h('div.item-main', [h('div.item-name', r.name)]),
              h('span.item-kcal', r.best + ' lb')
            ]);
          }));
        })()
      ]),

      h('div.card', [
        h('div.card-head', [
          h('h2.card-title', 'Measurements'),
          h('button.btn.ghost.sm', { onclick: ctx.promptMeasurement }, '+ Add')
        ]),
        (function () {
          var ms = Store.get().measurements.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
          if (!ms.length) return h('p.empty', 'Waist is the one that matters most in a cut — the scale stalls, the tape keeps moving.');
          return h('ul.list', ms.slice(0, 10).map(function (m) {
            return h('li', [
              h('div.item-main', [
                h('div.item-name', Store.prettyDate(m.date)),
                h('div.item-sub', ['waist ' + m.waist, m.chest ? 'chest ' + m.chest : null,
                  m.arm ? 'arm ' + m.arm : null, m.thigh ? 'thigh ' + m.thigh : null]
                  .filter(Boolean).join(' · '))
              ])
            ]);
          }));
        })()
      ])
    ]);
  }

  /* ---------- history & records ---------- */

  /* Expand/collapse state for lists that would otherwise dominate the page.
     Deliberately not persisted — it resets to the tidy view each visit. */
  var uiState = { showAllPBs: false };
  var PB_PREVIEW = 8;

  function history(ctx) {
    var pbs = Records.personalBests();
    var streak = Records.loggingStreak();
    var all = Records.allTime();
    var days = Records.dailyHistory(90);
    var heaviest = Records.heaviestSet();
    var bestSession = Records.bestSession();
    var bestWeek = Records.bestWeek();
    var lowest = Records.lowestWeight();

    function recordRow(icon, title, value, sub) {
      return h('div.advice', [
        h('div.advice-icon', icon),
        h('div.advice-body', [
          h('p.advice-title', title),
          h('p.advice-text', value + (sub ? ' · ' + sub : ''))
        ])
      ]);
    }

    return frag([
      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'Streak'),
        h('div.grid-3', [
          stat('Current', streak.current, streak.current === 1 ? 'day logged' : 'days logged'),
          stat('Longest', streak.longest, 'day run'),
          stat('Days logged', all.foodDays, 'all time')
        ]),
        streak.current === 0
          ? h('div.hint', 'Nothing logged yet today. A day you skip is a hole in the data the coach uses — log it even when it is ugly.')
          : h('div.hint', 'Every day you log is saved permanently on this device and listed below. Nothing rolls off.')
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:6px' }, 'Records'),
        heaviest || bestSession || lowest
          ? frag([
              heaviest ? recordRow('🏋️', 'Heaviest set',
                heaviest.weight + ' lb × ' + heaviest.reps,
                heaviest.exercise + ', ' + Store.prettyDate(heaviest.date)) : null,
              bestSession ? recordRow('📦', 'Biggest session',
                bestSession.volume.toLocaleString() + ' lb',
                bestSession.name + ', ' + Store.prettyDate(bestSession.date)) : null,
              bestWeek ? recordRow('📅', 'Biggest week',
                bestWeek.volume.toLocaleString() + ' lb',
                bestWeek.sessions + ' sessions, week ending ' + Store.prettyDate(bestWeek.end)) : null,
              lowest ? recordRow('⚖️', 'Lowest bodyweight',
                lowest.lbs + ' lb', Store.prettyDate(lowest.date)) : null
            ])
          : h('p.empty', 'Log a session or a weigh-in and your records start here.')
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'Best per lift'),
        pbs.length
          ? frag([
              h('ul.list', (uiState.showAllPBs ? pbs : pbs.slice(0, PB_PREVIEW)).map(function (p) {
                return h('li', [
                  h('div.item-main', [
                    h('div.item-name', p.exercise),
                    h('div.item-sub', p.weight + ' lb × ' + p.reps + ' · ' + Store.prettyDate(p.date))
                  ]),
                  h('span.item-kcal', p.e1rm + ' lb')
                ]);
              })),
              pbs.length > PB_PREVIEW ? h('button.btn.ghost.sm', {
                style: 'width:100%;margin-top:10px',
                onclick: function () { uiState.showAllPBs = !uiState.showAllPBs; ctx.rerender(); }
              }, uiState.showAllPBs
                ? 'Show fewer'
                : 'Show all ' + pbs.length + ' lifts') : null
            ])
          : h('p.empty', 'No lifts logged yet.'),
        pbs.length ? h('div.hint', 'Estimated 1RM from your best set on each lift, most recent first. Beating one of these in the logger earns a ★.') : null
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'All time'),
        h('div.grid-4', [
          stat('Sessions', all.sessions),
          stat('Working sets', all.sets),
          stat('Tonnage', Math.round(all.tonnage / 1000) + 'k', 'lb lifted'),
          stat('Weigh-ins', all.weighIns)
        ])
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:4px' }, 'Every day you logged'),
        h('p.card-sub', { style: 'margin-bottom:10px' }, 'Tap any day to open it and edit what you entered.'),
        days.length
          ? h('ul.list', days.map(function (d) {
              var hitKcal = d.entries && d.kcal <= d.kcalTarget * 1.02;
              var hitProtein = d.entries && d.protein >= d.proteinTarget * 0.95;
              return h('li', {
                style: 'cursor:pointer',
                onclick: function () { ctx.setDate(d.date); ctx.go('food'); }
              }, [
                h('div.item-main', [
                  h('div.item-name', Store.prettyDate(d.date)),
                  h('div.item-sub', [
                    d.entries ? d.kcal + ' kcal · ' + d.protein + 'g protein' : 'no food logged',
                    d.weight ? ' · ' + d.weight + ' lb' : '',
                    d.sessions.length ? ' · ' + d.sessions.map(function (s) { return s.name; }).join(', ') : ''
                  ].join(''))
                ]),
                h('span.tiny', [
                  hitKcal ? h('span.good', '●') : null,
                  hitProtein ? h('span.good', '●') : null,
                  d.sessions.length ? h('span.faint', ' 🏋️') : null
                ])
              ]);
            }))
          : h('p.empty', 'Nothing logged yet. Days appear here the moment you log anything.')
      ])
    ]);
  }

  /* ---------- coach ---------- */

  function coach(ctx) {
    var t = Nutrition.currentTargets();
    var measured = Coach.measuredTdee(21);
    var s = Store.get();
    var advice = Coach.advice();

    return frag([
      h('div.card', [
        h('div.card-head', [
          h('h2.card-title', 'Your numbers'),
          h('button.btn.ghost.sm', { onclick: ctx.openSettings }, 'Adjust')
        ]),
        h('div.grid-4', [
          stat('Calories', t.kcal, t.manual ? 'manual' : Nutrition.GOALS[s.profile.goal].label.split(' —')[0]),
          stat('Protein', t.protein + 'g'),
          stat('Carbs', t.carbs + 'g'),
          stat('Fat', t.fat + 'g')
        ]),
        h('div.grid-2.mt', [
          stat('Predicted maintenance', t.tdee, 'Mifflin-St Jeor × activity'),
          stat('Measured maintenance', measured ? measured.tdee : '—',
            measured ? 'from ' + measured.loggedDays + ' days of your data' : 'needs 10+ logged days')
        ]),
        measured ? h('div.row.mt', [
          h('button.btn.ghost.sm', {
            onclick: function () {
              var goal = Nutrition.GOALS[s.profile.goal] || { sign: 0 };
              var kcal = Math.round(measured.tdee + goal.sign * Math.abs(s.profile.rateLbsPerWeek) * 3500 / 7);
              var weight = (Store.latestWeight() || {}).lbs || 180;
              var m = Nutrition.macroTargets(s.profile, weight, kcal);
              Store.update(function (st) { st.targets = m; });
              ctx.rerender();
            }
          }, 'Rebuild targets from measured maintenance')
        ]) : null,
        h('div.hint', 'The predicted number is a starting guess with roughly ±10% error. The measured one comes from what you actually ate and what the scale actually did — trust it once it appears.')
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:6px' }, 'What to do next'),
        advice.length ? advice.map(adviceRow) : h('p.empty', 'Log a few days and check back.')
      ]),

      h('div.card', [
        h('h2.card-title', { style: 'margin-bottom:10px' }, 'The short version'),
        h('div.advice', [
          h('div.advice-icon', '1'),
          h('div.advice-body', [
            h('p.advice-title', 'Calories decide your weight'),
            h('p.advice-text', 'Nothing else does. Not meal timing, not carbs at night, not the supplement. A deficit of 500/day is roughly a pound a week.')
          ])
        ]),
        h('div.advice', [
          h('div.advice-icon', '2'),
          h('div.advice-body', [
            h('p.advice-title', 'Protein and lifting decide what you lose'),
            h('p.advice-text', 'Same deficit, two outcomes. With ~1g/lb of protein and three to four hard lifting sessions a week, most of the loss is fat. Without them, a large chunk is muscle — and that is the version people describe as looking "skinny fat" at the end.')
          ])
        ]),
        h('div.advice', [
          h('div.advice-icon', '3'),
          h('div.advice-body', [
            h('p.advice-title', 'Steps are the cheapest lever you own'),
            h('p.advice-text', '8-10k a day burns a few hundred calories without touching recovery, unlike adding more hard cardio on top of lifting.')
          ])
        ]),
        h('div.advice', [
          h('div.advice-icon', '4'),
          h('div.advice-body', [
            h('p.advice-title', 'Sleep is a training variable'),
            h('p.advice-text', 'Under 7 hours and you lose measurably more muscle per pound dropped, plus appetite regulation goes sideways. It is not a lifestyle footnote.')
          ])
        ]),
        h('div.advice', [
          h('div.advice-icon', '5'),
          h('div.advice-body', [
            h('p.advice-title', 'Judge the trend, not the day'),
            h('p.advice-text', 'Daily weight swings 3-5 lbs on sodium, carbs, and water. Two weeks of the 7-day average moving is a signal; Tuesday being up is not.')
          ])
        ])
      ]),

      h('p.tiny.faint.center', 'General fitness information, not medical advice. Check with a doctor before starting a new diet or training program, especially with existing conditions or medication.')
    ]);
  }

  global.Views = {
    h: h, frag: frag, stat: stat, macroBar: macroBar, adviceRow: adviceRow,
    dashboard: dashboard, food: food, train: train, progress: progress,
    history: history, coach: coach
  };
})(window);
