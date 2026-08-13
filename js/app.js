/* Wiring: routing, modals, onboarding, import/export. */
(function (global) {
  'use strict';

  var h = Views.h;
  var app = document.getElementById('app');
  var modalRoot = document.getElementById('modal-root');

  var ctx = {
    view: 'dashboard',
    date: Store.today(),
    draft: null,          // workout being edited
    rerender: render,
    go: go,
    setDate: setDate,
    openSettings: openSettings,
    promptWeight: promptWeight,
    promptQuantity: promptQuantity,
    promptCustomFood: promptCustomFood,
    promptAddExercise: promptAddExercise,
    promptMeasurement: promptMeasurement,
    startBlankWorkout: startBlankWorkout,
    startFromTemplate: startFromTemplate,
    openWorkout: openWorkout,
    closeWorkout: closeWorkout,
    autosave: autosave,
    confirm: confirmModal,
    notify: notify
  };

  /* ---------- routing ---------- */

  function go(view) {
    ctx.view = view;
    if (view !== 'train') ctx.draft = null;
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.view === view);
    });
    window.scrollTo(0, 0);
    render();
  }

  function setDate(key) {
    if (key > Store.today()) return;
    ctx.date = key;
    render();
  }

  function render() {
    app.innerHTML = '';
    app.appendChild(Views[ctx.view](ctx));
    document.getElementById('today-label').textContent =
      Store.fromKey(Store.today()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /* ---------- modal plumbing ---------- */

  function modal(title, bodyFn) {
    var back = h('div.modal-back', {
      onclick: function (e) { if (e.target === back) close(); }
    });
    function close() { modalRoot.innerHTML = ''; }
    var box = h('div.modal', [h('h2', title)]);
    box.appendChild(bodyFn(close));
    back.appendChild(box);
    modalRoot.innerHTML = '';
    modalRoot.appendChild(back);
    var firstInput = box.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
    return close;
  }

  /* In-page replacements for confirm()/alert(). Sandboxed frames — which is
     what the hosted build runs in — routinely suppress native dialogs, and a
     suppressed confirm() silently returns false, so a delete button would just
     stop working with no explanation. */
  function confirmModal(title, message, confirmLabel, onYes) {
    modal(title, function (close) {
      return Views.frag([
        h('p.card-sub', message),
        h('div.row.mt', { style: 'justify-content:flex-end' }, [
          h('button.btn.ghost', { onclick: close }, 'Cancel'),
          h('button.btn.danger', {
            onclick: function () { close(); onYes(); }
          }, confirmLabel)
        ])
      ]);
    });
  }

  function notify(title, message) {
    modal(title, function (close) {
      return Views.frag([
        h('p.card-sub', message),
        h('div.row.mt', { style: 'justify-content:flex-end' }, [
          h('button.btn', { onclick: close }, 'OK')
        ])
      ]);
    });
  }

  function actions(close, onSave, saveLabel) {
    return h('div.row.mt', { style: 'justify-content:flex-end' }, [
      h('button.btn.ghost', { onclick: close }, 'Cancel'),
      h('button.btn', { onclick: onSave }, saveLabel || 'Save')
    ]);
  }

  /* ---------- prompts ---------- */

  function promptWeight() {
    modal('Log weigh-in', function (close) {
      var latest = Store.latestWeight();
      var dateIn = h('input', { type: 'date', value: Store.today(), max: Store.today() });
      var lbsIn = h('input', {
        type: 'number', step: '0.1', inputmode: 'decimal',
        placeholder: 'lbs', value: latest ? latest.lbs : ''
      });
      function save() {
        var v = parseFloat(lbsIn.value);
        if (!v || v <= 0) { lbsIn.focus(); return; }
        Store.logWeight(dateIn.value || Store.today(), Math.round(v * 10) / 10);
        close(); render();
      }
      return Views.frag([
        h('div.grid-2', [
          h('label.field', [h('span', 'Weight (lb)'), lbsIn]),
          h('label.field', [h('span', 'Date'), dateIn])
        ]),
        h('div.hint', 'Same conditions every time: first thing in the morning, after the bathroom, before eating or drinking.'),
        actions(close, save)
      ]);
    });
  }

  function promptQuantity(food, date) {
    modal(food.name, function (close) {
      var qtyIn = h('input', { type: 'number', step: 'any', inputmode: 'decimal', value: food.serving });
      var preview = h('p.card-sub');

      function scaled() {
        var q = parseFloat(qtyIn.value);
        return Nutrition.scaleFood(food, isNaN(q) ? 0 : q);
      }
      function refresh() {
        var s = scaled();
        preview.textContent = s.kcal + ' kcal · ' + s.p + 'g protein · ' + s.c + 'g carbs · ' + s.f + 'g fat';
      }
      qtyIn.addEventListener('input', refresh);
      refresh();

      function save() {
        var s = scaled();
        if (!s.qty) { qtyIn.focus(); return; }
        Store.addFood(date, s);
        close(); render();
      }

      return Views.frag([
        h('label.field', [h('span', 'Quantity (' + food.unit + ')'), qtyIn]),
        h('div.row.row-wrap', { style: 'gap:6px;margin-top:8px' },
          [0.5, 1, 1.5, 2, 3].map(function (mult) {
            return h('span.chip', {
              onclick: function () { qtyIn.value = food.serving * mult; refresh(); }
            }, (food.serving * mult) + ' ' + food.unit);
          })),
        h('div', { style: 'margin-top:12px' }, [preview]),
        actions(close, save, 'Add')
      ]);
    });
  }

  function promptCustomFood(prefill) {
    modal('New food', function (close) {
      var nameIn = h('input', { value: prefill || '', placeholder: 'e.g. Mom\'s chili' });
      var unitIn = h('input', { value: 'serving' });
      var servIn = h('input', { type: 'number', step: 'any', value: 1 });
      var kcalIn = h('input', { type: 'number', inputmode: 'numeric', placeholder: '0' });
      var pIn = h('input', { type: 'number', step: 'any', placeholder: '0' });
      var cIn = h('input', { type: 'number', step: 'any', placeholder: '0' });
      var fIn = h('input', { type: 'number', step: 'any', placeholder: '0' });

      function save() {
        var name = nameIn.value.trim();
        if (!name) { nameIn.focus(); return; }
        var food = {
          name: name,
          unit: unitIn.value.trim() || 'serving',
          serving: parseFloat(servIn.value) || 1,
          kcal: parseFloat(kcalIn.value) || 0,
          p: parseFloat(pIn.value) || 0,
          c: parseFloat(cIn.value) || 0,
          f: parseFloat(fIn.value) || 0,
          tags: 'custom'
        };
        Store.update(function (s) { s.customFoods.push(food); });
        close();
        promptQuantity(food, ctx.date);
      }

      return Views.frag([
        h('label.field', [h('span', 'Name'), nameIn]),
        h('div.grid-2.mt', [
          h('label.field', [h('span', 'Serving size'), servIn]),
          h('label.field', [h('span', 'Unit'), unitIn])
        ]),
        h('div.grid-2.mt', [
          h('label.field', [h('span', 'Calories'), kcalIn]),
          h('label.field', [h('span', 'Protein (g)'), pIn])
        ]),
        h('div.grid-2.mt', [
          h('label.field', [h('span', 'Carbs (g)'), cIn]),
          h('label.field', [h('span', 'Fat (g)'), fIn])
        ]),
        h('div.hint', 'Copy the numbers straight off the label for one serving. Custom foods are searchable forever after.'),
        actions(close, save, 'Save & add')
      ]);
    });
  }

  function promptAddExercise() {
    modal('Add exercise', function (close) {
      var results = h('div.results');
      var search = h('input', { type: 'search', placeholder: 'Search or type a new name…' });

      function pick(name) {
        ctx.draft.exercises.push({
          name: name,
          sets: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }]
        });
        autosave();
        close();
        render();
      }

      function refresh() {
        results.innerHTML = '';
        var list = Workouts.search(search.value, 40);
        list.forEach(function (e) {
          results.appendChild(h('div.result', { onclick: function () { pick(e.name); } }, [
            h('div', [
              h('div.result-name', e.name),
              h('div.result-macros', e.muscle + ' · ' + e.equipment)
            ]),
            h('span.faint', '+')
          ]));
        });
        var q = search.value.trim();
        if (q && !Workouts.find(q)) {
          results.appendChild(h('div.result', { onclick: function () { pick(q); } }, [
            h('div.result-name', 'Add custom: "' + q + '"'),
            h('span.faint', '+')
          ]));
        }
      }
      search.addEventListener('input', refresh);
      refresh();

      return Views.frag([search, results]);
    });
  }

  function promptMeasurement() {
    modal('Measurements', function (close) {
      var dateIn = h('input', { type: 'date', value: Store.today(), max: Store.today() });
      var waist = h('input', { type: 'number', step: 'any', placeholder: 'in' });
      var chest = h('input', { type: 'number', step: 'any', placeholder: 'in' });
      var arm = h('input', { type: 'number', step: 'any', placeholder: 'in' });
      var thigh = h('input', { type: 'number', step: 'any', placeholder: 'in' });

      function save() {
        var m = {
          date: dateIn.value || Store.today(),
          waist: parseFloat(waist.value) || null,
          chest: parseFloat(chest.value) || null,
          arm: parseFloat(arm.value) || null,
          thigh: parseFloat(thigh.value) || null
        };
        if (!m.waist && !m.chest && !m.arm && !m.thigh) { waist.focus(); return; }
        Store.update(function (s) { s.measurements.push(m); });
        close(); render();
      }

      return Views.frag([
        h('label.field', [h('span', 'Date'), dateIn]),
        h('div.grid-2.mt', [
          h('label.field', [h('span', 'Waist (at navel)'), waist]),
          h('label.field', [h('span', 'Chest'), chest])
        ]),
        h('div.grid-2.mt', [
          h('label.field', [h('span', 'Arm (flexed)'), arm]),
          h('label.field', [h('span', 'Thigh'), thigh])
        ]),
        h('div.hint', 'Every 2-4 weeks is plenty. Waist at the navel is the most honest single number in a cut.'),
        actions(close, save)
      ]);
    });
  }

  /* ---------- workout draft handling ---------- */

  function startBlankWorkout() {
    ctx.draft = {
      id: Store.newId(), date: ctx.date, name: 'Workout',
      notes: '', exercises: []
    };
    Store.saveWorkout(ctx.draft);
    go('train');
  }

  function startFromTemplate(programId, dayIndex) {
    var w = Workouts.fromTemplate(programId, dayIndex);
    w.date = ctx.date;
    ctx.draft = w;
    Store.saveWorkout(w);
    go('train');
  }

  function openWorkout(id) {
    var w = Store.get().workouts.filter(function (x) { return x.id === id; })[0];
    if (!w) return;
    ctx.draft = w;
    go('train');
  }

  function closeWorkout() {
    var w = ctx.draft;
    clearTimeout(saveTimer);
    if (!w) { render(); return; }
    // Drop a session that was opened and left completely empty.
    if (!w.exercises.length) Store.deleteWorkout(w.id);
    else Store.saveWorkout(w);
    ctx.draft = null;
    render();
  }

  var saveTimer = null;
  function autosave() {
    var w = ctx.draft;
    if (!w) return;
    clearTimeout(saveTimer);
    // Capture the draft: the timer can outlive the editor being closed.
    saveTimer = setTimeout(function () { Store.saveWorkout(w); }, 250);
  }

  /* ---------- settings & onboarding ---------- */

  function openSettings(isOnboarding) {
    var p = Store.get().profile;
    modal(isOnboarding === true ? 'Set up your plan' : 'Settings', function (close) {
      var name = h('input', { value: p.name, placeholder: 'Optional' });
      var sex = h('select', [
        h('option', { value: 'male', selected: p.sex === 'male' }, 'Male'),
        h('option', { value: 'female', selected: p.sex === 'female' }, 'Female')
      ]);
      var age = h('input', { type: 'number', value: p.age });
      var ft = h('input', { type: 'number', value: Math.floor(p.heightIn / 12) });
      var inches = h('input', { type: 'number', value: p.heightIn % 12 });
      var weight = h('input', {
        type: 'number', step: '0.1',
        value: (Store.latestWeight() || {}).lbs || p.startWeight || ''
      });
      var goalWeight = h('input', { type: 'number', step: '0.1', value: p.goalWeight || '' });
      var activity = h('select', Nutrition.ACTIVITY_LEVELS.map(function (a) {
        return h('option', { value: a.value, selected: Number(p.activity) === a.value }, a.label);
      }));
      var goal = h('select', Object.keys(Nutrition.GOALS).map(function (k) {
        return h('option', { value: k, selected: p.goal === k }, Nutrition.GOALS[k].label);
      }));
      var rate = h('input', { type: 'number', step: '0.25', value: p.rateLbsPerWeek });
      var kcalOverride = h('input', {
        type: 'number', placeholder: 'auto',
        value: (Store.get().targets && Store.get().targets.kcal) || ''
      });
      var preview = h('p.card-sub');

      function currentProfile() {
        return {
          name: name.value.trim(),
          sex: sex.value,
          age: parseInt(age.value, 10) || 30,
          heightIn: (parseInt(ft.value, 10) || 0) * 12 + (parseInt(inches.value, 10) || 0),
          activity: parseFloat(activity.value),
          goal: goal.value,
          rateLbsPerWeek: Math.abs(parseFloat(rate.value) || 0),
          startWeight: p.startWeight,
          goalWeight: parseFloat(goalWeight.value) || null
        };
      }

      function refresh() {
        var prof = currentProfile();
        var w = parseFloat(weight.value) || 180;
        var kcal = Nutrition.calorieTarget(prof, w);
        var m = Nutrition.macroTargets(prof, w, kcal);
        preview.textContent = 'Maintenance ≈ ' + Nutrition.tdee(prof, w) + ' kcal · target ' +
          kcal + ' kcal · ' + m.protein + 'p / ' + m.carbs + 'c / ' + m.fat + 'f';
      }
      [sex, age, ft, inches, weight, activity, goal, rate].forEach(function (el) {
        el.addEventListener('input', refresh);
        el.addEventListener('change', refresh);
      });
      refresh();

      function save() {
        var prof = currentProfile();
        var w = parseFloat(weight.value);
        Store.update(function (s) {
          s.profile = Object.assign(s.profile, prof);
          var override = parseInt(kcalOverride.value, 10);
          if (override > 0) {
            s.targets = Nutrition.macroTargets(prof, w || 180, override);
          } else {
            s.targets = null;
          }
        });
        if (w > 0) Store.logWeight(Store.today(), Math.round(w * 10) / 10);
        close(); render();
      }

      return Views.frag([
        h('label.field', [h('span', 'Name'), name]),
        h('div.grid-2.mt', [
          h('label.field', [h('span', 'Sex'), sex]),
          h('label.field', [h('span', 'Age'), age])
        ]),
        h('div.grid-2.mt', [
          h('label.field', [h('span', 'Height (ft)'), ft]),
          h('label.field', [h('span', 'Height (in)'), inches])
        ]),
        h('div.grid-2.mt', [
          h('label.field', [h('span', 'Current weight (lb)'), weight]),
          h('label.field', [h('span', 'Goal weight (lb)'), goalWeight])
        ]),
        h('label.field.mt', [h('span', 'Activity outside training'), activity]),
        h('div.grid-2.mt', [
          h('label.field', [h('span', 'Goal'), goal]),
          h('label.field', [h('span', 'Rate (lb/week)'), rate])
        ]),
        h('label.field.mt', [h('span', 'Calorie override'), kcalOverride]),
        h('div', { style: 'margin-top:12px' }, [preview]),
        h('div.hint', '0.5-1% of bodyweight per week is the sweet spot for losing fat while keeping muscle. Faster costs you muscle and makes training miserable.'),
        actions(close, save),
        isOnboarding === true ? null : h('div', { style: 'margin-top:18px;border-top:1px solid var(--line);padding-top:12px' }, [
          h('button.btn.danger.sm', {
            onclick: function () {
              close();
              confirmModal('Erase all data?',
                'Every weigh-in, food entry, and workout on this device will be deleted. Export a backup first if you want one.',
                'Erase everything',
                function () { Store.reset(); render(); });
            }
          }, 'Erase all data')
        ])
      ]);
    });
  }

  /* ---------- export / import ---------- */

  function exportData() {
    var json = JSON.stringify(Store.get(), null, 2);
    var filename = 'forge-backup-' + Store.today() + '.json';

    // When the page is running as a published Artifact, anchor-click downloads
    // are blocked; the host offers the file through its own confirmation.
    if (global.claude && global.claude.downloads) {
      global.claude.downloads.save({ filename: filename, data: json })
        .catch(function (err) {
          if (err && err.code === 'declined') return;
          notify('Backup not saved',
            'The download was not completed (' + ((err && err.code) || 'unknown') + '). Try again, or open the app in a normal browser tab to export from there.');
        });
      return;
    }

    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* Shown only when the browser is throwing away writes — see Store.persistent. */
  function storageBanner() {
    if (Store.persistent) return;
    var banner = h('div.banner', [
      h('b', 'This browser is not saving your data'),
      h('span.tiny', 'Anything you log will disappear when you close the tab. '),
      h('button.linklike', { onclick: exportData }, 'Export a backup'),
      h('span.tiny', ' before you go, or open the app in a normal browser tab where storage works.')
    ]);
    document.body.insertBefore(banner, app);
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (e) {
        notify('Could not read that file', 'It is not a Forge backup — the contents are not valid JSON.');
        return;
      }
      if (!data || (!data.profile && !data.weights && !data.food)) {
        notify('Could not read that file', 'That JSON does not look like a Forge backup: it has no profile, weigh-ins, or food log.');
        return;
      }
      confirmModal('Replace everything?',
        'Importing this backup overwrites all data currently on this device.',
        'Import and replace',
        function () { Store.replaceAll(data); render(); });
    };
    reader.readAsText(file);
  }

  /* ---------- boot ---------- */

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () { go(tab.dataset.view); });
  });
  document.getElementById('btn-settings').addEventListener('click', function () { openSettings(); });
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-import').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', function () {
    if (this.files && this.files[0]) importData(this.files[0]);
    this.value = '';
  });

  storageBanner();
  render();

  // First run: no weigh-ins and no food means an unconfigured install.
  if (!Store.get().weights.length && !Object.keys(Store.get().food).length) {
    openSettings(true);
  }

  global.App = ctx;
})(window);
