/* Records and history.

   Two questions this answers: "is everything I logged still there?" and "what
   are my bests?" Both read straight from the store — nothing here is cached or
   derived at write time, so a record can never drift from the log that proves
   it. Every record carries the date it was set. */
(function (global) {
  'use strict';

  function e1rmOf(set) {
    return Workouts.e1rm(Number(set.weight), Number(set.reps));
  }

  function isWorkingSet(set) {
    return Number(set.reps) > 0 && Number(set.weight) >= 0;
  }

  var Records = {
    /* Best estimated 1RM per exercise, with the set and date that produced it.
       Sorted by how recently the record was set so the page opens on what you
       have been actually training. */
    personalBests: function () {
      var best = {};
      Store.get().workouts.forEach(function (w) {
        (w.exercises || []).forEach(function (ex) {
          (ex.sets || []).forEach(function (s) {
            if (!isWorkingSet(s)) return;
            var e = e1rmOf(s);
            if (!e) return;
            var cur = best[ex.name];
            if (!cur || e > cur.e1rm) {
              best[ex.name] = {
                exercise: ex.name,
                e1rm: e,
                weight: Number(s.weight),
                reps: Number(s.reps),
                date: w.date
              };
            }
          });
        });
      });
      return Object.keys(best).map(function (k) { return best[k]; })
        .sort(function (a, b) {
          if (a.date !== b.date) return a.date < b.date ? 1 : -1;
          return b.e1rm - a.e1rm;
        });
    },

    /* Heaviest weight ever moved for a single rep or more, regardless of lift. */
    heaviestSet: function () {
      var top = null;
      Store.get().workouts.forEach(function (w) {
        (w.exercises || []).forEach(function (ex) {
          (ex.sets || []).forEach(function (s) {
            if (!isWorkingSet(s)) return;
            var weight = Number(s.weight);
            if (!weight) return;
            if (!top || weight > top.weight) {
              top = { exercise: ex.name, weight: weight, reps: Number(s.reps), date: w.date };
            }
          });
        });
      });
      return top;
    },

    bestSession: function () {
      var top = null;
      Store.get().workouts.forEach(function (w) {
        var vol = Workouts.workoutVolume(w);
        if (!vol) return;
        if (!top || vol > top.volume) {
          top = { name: w.name || 'Workout', date: w.date, volume: vol };
        }
      });
      return top;
    },

    bestWeek: function () {
      var weeks = Workouts.volumeByWeek(52).filter(function (w) { return w.volume > 0; });
      if (!weeks.length) return null;
      return weeks.reduce(function (a, b) { return b.volume > a.volume ? b : a; });
    },

    lowestWeight: function () {
      var ws = Store.sortedWeights();
      if (!ws.length) return null;
      return ws.reduce(function (a, b) { return b.lbs < a.lbs ? b : a; });
    },

    /* Consecutive days with food logged, counting back from today. Today not
       being logged yet does not break the streak — it has not happened yet. */
    loggingStreak: function () {
      var food = Store.get().food;
      var today = Store.today();
      var cursor = food[today] && food[today].length ? today : Store.addDays(today, -1);
      var current = 0;
      while (food[cursor] && food[cursor].length) {
        current++;
        cursor = Store.addDays(cursor, -1);
      }

      var days = Object.keys(food).filter(function (d) { return food[d].length; }).sort();
      var longest = 0, run = 0, prev = null;
      days.forEach(function (d) {
        run = (prev && Store.daysBetween(prev, d) === 1) ? run + 1 : 1;
        if (run > longest) longest = run;
        prev = d;
      });
      return { current: current, longest: longest, totalDays: days.length };
    },

    allTime: function () {
      var s = Store.get();
      var sets = 0, tonnage = 0;
      s.workouts.forEach(function (w) {
        (w.exercises || []).forEach(function (ex) {
          (ex.sets || []).forEach(function (st) { if (isWorkingSet(st)) sets++; });
        });
        tonnage += Workouts.workoutVolume(w);
      });
      return {
        sessions: s.workouts.length,
        sets: sets,
        tonnage: tonnage,
        weighIns: s.weights.length,
        foodDays: Object.keys(s.food).filter(function (d) { return s.food[d].length; }).length
      };
    },

    /* Every day you logged anything, newest first — the proof that nothing has
       been dropped. Days are assembled from the union of the three logs, so a
       day with only a weigh-in still shows up. */
    dailyHistory: function (limit) {
      var s = Store.get();
      var seen = {};
      Object.keys(s.food).forEach(function (d) { if (s.food[d].length) seen[d] = true; });
      s.weights.forEach(function (w) { seen[w.date] = true; });
      s.workouts.forEach(function (w) { seen[w.date] = true; });

      var targets = Nutrition.currentTargets();

      return Object.keys(seen)
        .sort(function (a, b) { return a < b ? 1 : -1; })
        .slice(0, limit || 90)
        .map(function (date) {
          var entries = s.food[date] || [];
          var totals = Nutrition.totals(entries);
          var weight = s.weights.filter(function (w) { return w.date === date; })[0];
          var sessions = s.workouts.filter(function (w) { return w.date === date; });
          return {
            date: date,
            entries: entries.length,
            kcal: Math.round(totals.kcal),
            protein: Math.round(totals.protein),
            kcalTarget: targets.kcal,
            proteinTarget: targets.protein,
            weight: weight ? weight.lbs : null,
            sessions: sessions.map(function (w) {
              return { name: w.name || 'Workout', volume: Workouts.workoutVolume(w) };
            })
          };
        });
    }
  };

  global.Records = Records;
})(window);
