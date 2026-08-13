/* Persistence layer. Everything lives in localStorage under one key so that
   export/import is a single JSON blob. */
(function (global) {
  'use strict';

  var KEY = 'forge.v1';

  var DEFAULTS = {
    version: 1,
    profile: {
      name: '',
      sex: 'male',
      age: 27,
      heightIn: 72,
      activity: 1.45,
      goal: 'cut',
      rateLbsPerWeek: 0.75,
      startWeight: null,
      goalWeight: null
    },
    targets: null,        // null = derive from profile; object = manual override
    weights: [],          // {date, lbs}
    measurements: [],     // {date, waist, chest, arm, thigh}
    food: {},             // 'YYYY-MM-DD' -> [entry]
    customFoods: [],      // {name, unit, serving, kcal, p, c, f}
    workouts: [],         // {id, date, name, notes, exercises:[{name, sets:[{weight,reps}]}]}
    activeProgram: null,  // program id
    createdAt: null
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Some embedding contexts (sandboxed iframes, Safari private browsing, sites
     opened straight off the filesystem) either throw on localStorage access or
     hand back a store that silently drops writes. A tracker that loses your log
     without saying so is worse than one that admits it, so probe for real
     round-tripping up front and let the UI warn when it fails. */
  function probeStorage() {
    try {
      var probe = KEY + '.probe';
      global.localStorage.setItem(probe, 'x');
      var ok = global.localStorage.getItem(probe) === 'x';
      global.localStorage.removeItem(probe);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function load() {
    var raw = null;
    try { raw = global.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) {
      var fresh = clone(DEFAULTS);
      fresh.createdAt = Store.today();
      return fresh;
    }
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return clone(DEFAULTS); }
    // Merge forward so new fields appear on old saves.
    var merged = clone(DEFAULTS);
    Object.keys(parsed || {}).forEach(function (k) { merged[k] = parsed[k]; });
    merged.profile = Object.assign(clone(DEFAULTS.profile), parsed.profile || {});
    return merged;
  }

  var state = null;
  var listeners = [];

  var Store = {
    KEY: KEY,
    persistent: probeStorage(),

    get: function () {
      if (!state) state = load();
      return state;
    },

    save: function () {
      try {
        global.localStorage.setItem(KEY, JSON.stringify(Store.get()));
      } catch (e) {
        console.warn('Could not persist state:', e);
      }
      listeners.forEach(function (fn) { fn(state); });
    },

    /* Mutate then persist then notify. */
    update: function (fn) {
      fn(Store.get());
      Store.save();
    },

    onChange: function (fn) { listeners.push(fn); },

    reset: function () {
      state = clone(DEFAULTS);
      state.createdAt = Store.today();
      Store.save();
    },

    replaceAll: function (data) {
      var merged = clone(DEFAULTS);
      Object.keys(data || {}).forEach(function (k) { merged[k] = data[k]; });
      merged.profile = Object.assign(clone(DEFAULTS.profile), data.profile || {});
      state = merged;
      Store.save();
    },

    /* ---------- date helpers (local time, not UTC) ---------- */

    today: function () { return Store.toKey(new Date()); },

    toKey: function (d) {
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return d.getFullYear() + '-' + m + '-' + day;
    },

    fromKey: function (key) {
      var p = key.split('-');
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    },

    addDays: function (key, n) {
      var d = Store.fromKey(key);
      d.setDate(d.getDate() + n);
      return Store.toKey(d);
    },

    daysBetween: function (a, b) {
      return Math.round((Store.fromKey(b) - Store.fromKey(a)) / 86400000);
    },

    prettyDate: function (key) {
      var d = Store.fromKey(key);
      var t = Store.today();
      if (key === t) return 'Today';
      if (key === Store.addDays(t, -1)) return 'Yesterday';
      if (key === Store.addDays(t, 1)) return 'Tomorrow';
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    },

    /* ---------- accessors ---------- */

    foodFor: function (dateKey) {
      var s = Store.get();
      return s.food[dateKey] || [];
    },

    addFood: function (dateKey, entry) {
      Store.update(function (s) {
        if (!s.food[dateKey]) s.food[dateKey] = [];
        s.food[dateKey].push(entry);
      });
    },

    removeFood: function (dateKey, index) {
      Store.update(function (s) {
        if (s.food[dateKey]) s.food[dateKey].splice(index, 1);
      });
    },

    latestWeight: function () {
      var w = Store.get().weights;
      if (!w.length) return null;
      return w[w.length - 1];
    },

    sortedWeights: function () {
      return Store.get().weights.slice().sort(function (a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      });
    },

    logWeight: function (dateKey, lbs) {
      Store.update(function (s) {
        var existing = s.weights.filter(function (w) { return w.date === dateKey; })[0];
        if (existing) existing.lbs = lbs;
        else s.weights.push({ date: dateKey, lbs: lbs });
        s.weights.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
        if (!s.profile.startWeight) s.profile.startWeight = lbs;
      });
    },

    workoutsSorted: function () {
      return Store.get().workouts.slice().sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });
    },

    saveWorkout: function (workout) {
      if (!workout || !workout.id) return;
      Store.update(function (s) {
        var idx = -1;
        for (var i = 0; i < s.workouts.length; i++) {
          if (s.workouts[i].id === workout.id) { idx = i; break; }
        }
        if (idx >= 0) s.workouts[idx] = workout;
        else s.workouts.push(workout);
      });
    },

    deleteWorkout: function (id) {
      Store.update(function (s) {
        s.workouts = s.workouts.filter(function (w) { return w.id !== id; });
      });
    },

    newId: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
  };

  global.Store = Store;
})(window);
