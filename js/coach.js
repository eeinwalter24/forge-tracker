/* The Coach.

   Two jobs. First, replace the textbook TDEE estimate with your measured one:
   given what you actually ate and what the scale actually did, energy balance
   solves for real maintenance calories. Second, look at adherence, training
   volume, and lift progression, and say the one or two things that would most
   change the outcome.

   Everything here is a heuristic derived from your own logged data. None of it
   is medical advice. */
(function (global) {
  'use strict';

  function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  }

  function round(n, places) {
    var m = Math.pow(10, places || 0);
    return Math.round(n * m) / m;
  }

  /* Days in the trailing window that have any food logged at all. */
  function loggedDays(days) {
    var out = [];
    var today = Store.today();
    for (var i = 0; i < days; i++) {
      var key = Store.addDays(today, -i);
      var entries = Store.foodFor(key);
      if (entries.length) {
        out.push({ date: key, totals: Nutrition.totals(entries) });
      }
    }
    return out.reverse();
  }

  /* Weight trend from a smoothed series, in lbs/week, over the trailing window.
     Uses least-squares on the smoothed points so a single bad weigh-in cannot
     swing the slope. */
  function weightTrend(days) {
    var since = Store.addDays(Store.today(), -days);
    var pts = Store.sortedWeights().filter(function (w) { return w.date >= since; });
    if (pts.length < 3) return null;

    var smooth = Charts.movingAverage(pts.map(function (p) { return p.lbs; }), 5);
    var x = pts.map(function (p) { return Store.daysBetween(pts[0].date, p.date); });
    var mx = avg(x), my = avg(smooth);
    var num = 0, den = 0;
    for (var i = 0; i < x.length; i++) {
      num += (x[i] - mx) * (smooth[i] - my);
      den += (x[i] - mx) * (x[i] - mx);
    }
    if (!den) return null;
    var perDay = num / den;
    return {
      perWeek: perDay * 7,
      spanDays: x[x.length - 1],
      points: pts.length,
      current: smooth[smooth.length - 1],
      start: smooth[0]
    };
  }

  var Coach = {
    weightTrend: weightTrend,
    loggedDays: loggedDays,

    /* Energy balance solved backwards: maintenance = intake - (change in
       stored energy). Needs at least 10 logged food days and a real weight
       trend across the same window, or the noise swamps the signal. */
    measuredTdee: function (days) {
      days = days || 21;
      var logs = loggedDays(days);
      var trend = weightTrend(days);
      if (logs.length < 10 || !trend || trend.spanDays < 10) return null;

      var meanIntake = avg(logs.map(function (d) { return d.totals.kcal; }));
      var dailySurplus = (trend.perWeek / 7) * Nutrition.KCAL_PER_LB;
      return {
        tdee: Math.round(meanIntake - dailySurplus),
        meanIntake: Math.round(meanIntake),
        loggedDays: logs.length,
        windowDays: days,
        confidence: logs.length >= 0.75 * days ? 'good' : 'rough'
      };
    },

    /* Projected date of reaching goal weight at the current trend. */
    projection: function () {
      var s = Store.get();
      var goalW = s.profile.goalWeight;
      var trend = weightTrend(28) || weightTrend(56);
      if (!goalW || !trend || Math.abs(trend.perWeek) < 0.05) return null;
      var remaining = goalW - trend.current;
      // Trend must point at the goal, not away from it.
      if (remaining * trend.perWeek <= 0) return null;
      var weeks = Math.abs(remaining / trend.perWeek);
      if (weeks > 200) return null;
      return {
        weeks: round(weeks, 1),
        date: Store.addDays(Store.today(), Math.round(weeks * 7)),
        remaining: round(Math.abs(remaining), 1)
      };
    },

    /* Ordered advice. Highest-leverage items first; the UI shows the top few. */
    advice: function () {
      var s = Store.get();
      var out = [];
      var targets = Nutrition.currentTargets();
      var latest = Store.latestWeight();
      var goalMeta = Nutrition.GOALS[s.profile.goal] || {};

      function add(priority, icon, title, text) {
        out.push({ priority: priority, icon: icon, title: title, text: text });
      }

      /* --- setup gaps --- */
      if (!latest) {
        add(0, '⚖️', 'Log a weigh-in to start', 'Everything else keys off bodyweight. Weigh first thing in the morning, after the bathroom, before eating or drinking — same conditions every time. Daily is ideal; the app averages out the noise.');
        return out;
      }
      if (Store.get().weights.length < 5) {
        add(1, '📅', 'Keep weighing in daily', 'You have ' + Store.get().weights.length + ' weigh-in' + (Store.get().weights.length === 1 ? '' : 's') + '. Individual readings swing 3-5 lbs on water alone. Once you have ~10 days, the trend line becomes trustworthy and the coach can calculate your real maintenance calories.');
      }

      /* --- measured vs predicted maintenance --- */
      var measured = Coach.measuredTdee(21);
      if (measured) {
        var gap = measured.tdee - targets.tdee;
        if (Math.abs(gap) >= 150) {
          add(1, '🎯', 'Your real maintenance is about ' + measured.tdee + ' kcal',
            'The formula predicted ' + targets.tdee + ', but ' + measured.loggedDays + ' logged days against your weight trend say ' + measured.tdee + ' (' + (gap > 0 ? '+' : '') + gap + '). Prediction equations run ±10% on any individual. Set your target from the measured number in Settings.');
        }
      }

      /* --- rate of change vs intended rate --- */
      var trend = weightTrend(21);
      if (trend && trend.spanDays >= 10) {
        var actual = trend.perWeek;
        var intended = (goalMeta.sign || 0) * Math.abs(s.profile.rateLbsPerWeek || 0);
        var miss = actual - intended;
        var kcalShift = Math.round(Math.abs(miss) * Nutrition.KCAL_PER_LB / 7 / 25) * 25;

        if (goalMeta.sign < 0) {
          if (actual >= 0.1) {
            add(1, '📈', 'Weight is trending up, not down',
              'Trend is ' + (actual > 0 ? '+' : '') + round(actual, 2) + ' lb/week over ' + trend.spanDays + ' days while you are aiming for ' + round(intended, 2) + '. The usual cause is untracked intake — weekend meals, cooking oil, drinks — not a broken metabolism. Tighten logging for a week before changing calories.');
          } else if (miss > 0.35) {
            add(2, '🔽', 'Losing slower than planned',
              'You are at ' + round(actual, 2) + ' lb/week against a target of ' + round(intended, 2) + '. Drop roughly ' + kcalShift + ' kcal/day, or add ~2,000 steps, and hold for two more weeks before judging.');
          } else if (miss < -0.4) {
            add(2, '🔼', 'Losing faster than planned',
              'You are at ' + round(actual, 2) + ' lb/week versus a target of ' + round(intended, 2) + '. Fast loss costs muscle and makes training feel awful. Add about ' + kcalShift + ' kcal/day — mostly carbs, around training.');
          } else {
            add(4, '✅', 'Rate is dialed in',
              'Trending ' + round(actual, 2) + ' lb/week, right on target. Do not change anything. Consistency at this rate is what gets you there.');
          }
        } else if (goalMeta.sign > 0 && actual > 0.6) {
          add(2, '🔽', 'Gaining too fast for a lean bulk',
            'At ' + round(actual, 2) + ' lb/week you are adding more fat than necessary. Pull back ' + kcalShift + ' kcal/day; 0.25-0.5 lb/week is the range where most of the gain is muscle.');
        }
      }

      /* --- protein adherence --- */
      var logs14 = loggedDays(14);
      if (logs14.length >= 4) {
        var meanP = avg(logs14.map(function (d) { return d.totals.protein; }));
        if (meanP < targets.protein * 0.8) {
          add(1, '🥩', 'Protein is short by ~' + Math.round(targets.protein - meanP) + 'g/day',
            'You are averaging ' + Math.round(meanP) + 'g against a ' + targets.protein + 'g target. In a deficit, protein is the single variable that decides whether the weight you lose is fat or muscle. Anchor it: 40g at breakfast, 40g post-training, 40g at dinner, and the rest follows.');
        } else if (meanP >= targets.protein * 0.95) {
          add(5, '🥩', 'Protein is on point',
            'Averaging ' + Math.round(meanP) + 'g/day. That is the hardest habit in the whole plan and you have it.');
        }

        var meanKcal = avg(logs14.map(function (d) { return d.totals.kcal; }));
        if (meanKcal > targets.kcal * 1.12) {
          add(2, '🍽️', 'Running over your calorie target',
            'Averaging ' + Math.round(meanKcal) + ' vs a ' + targets.kcal + ' target across ' + logs14.length + ' logged days. Rather than white-knuckling it, find the 300 kcal you would not miss — liquid calories and cooking fats are usually the cheapest cuts.');
        }
      }

      /* --- logging consistency --- */
      var last7 = loggedDays(7);
      if (last7.length > 0 && last7.length < 5) {
        add(2, '📓', 'Only ' + last7.length + ' of the last 7 days logged',
          'Partial logs bias low — the untracked days are almost always the big ones. Log everything for 14 straight days, even the bad meals, especially the bad meals. The data is only useful if it is complete.');
      }

      /* --- alcohol --- */
      var alcoholKcal = 0;
      last7.forEach(function (d) {
        Store.foodFor(d.date).forEach(function (e) {
          if (/beer|wine|liquor|shot/i.test(e.name)) alcoholKcal += e.kcal || 0;
        });
      });
      if (alcoholKcal > 700) {
        add(3, '🍺', 'Alcohol is ~' + Math.round(alcoholKcal) + ' kcal this week',
          'That is about ' + round(alcoholKcal / Nutrition.KCAL_PER_LB, 1) + ' lb of fat loss per week in trade. Alcohol also blunts protein synthesis for roughly a day after and wrecks sleep quality. You do not have to quit — just decide in advance how many, and log them first.');
      }

      /* --- training frequency --- */
      var since14 = Store.addDays(Store.today(), -13);
      var recent = s.workouts.filter(function (w) { return w.date >= since14; });
      var perWeek = recent.length / 2;
      if (s.workouts.length === 0) {
        add(1, '🏋️', 'Load a program and train',
          'Lifting is what tells your body to keep muscle while calories are low. Without it, a large share of what you lose is lean mass. Pick a template on the Train tab — Upper/Lower 4x per week is the default recommendation.');
      } else if (perWeek < 2 && recent.length >= 0) {
        add(2, '🏋️', 'Training frequency is low',
          'About ' + round(perWeek, 1) + ' sessions/week over the last two weeks. Three is the floor for holding muscle in a deficit; four is where it gets comfortable. Shorter sessions more often beat long ones you skip.');
      }

      /* --- weekly volume by muscle --- */
      if (recent.length >= 3) {
        var sets = Workouts.weeklySetsByMuscle(since14);
        var low = Workouts.MUSCLES.filter(function (m) { return sets[m] / 2 < 6; });
        var high = Workouts.MUSCLES.filter(function (m) { return sets[m] / 2 > 24; });
        if (low.length && low.length <= 4) {
          add(3, '📊', 'Undertrained: ' + low.join(', '),
            'Under 6 hard sets per week for these. 10-20 weekly sets per muscle is the productive range — add a couple of sets to each and let the rest ride.');
        }
        if (high.length) {
          add(3, '⚠️', 'Very high volume: ' + high.join(', '),
            'Over 24 sets/week. Past ~20 the returns flatten and recovery cost keeps climbing, which bites hardest in a deficit. Trim the junk sets and push harder on the ones you keep.');
        }
      }

      /* --- progressive overload on main lifts --- */
      var mains = ['Barbell Back Squat', 'Barbell Bench Press', 'Trap Bar Deadlift', 'Conventional Deadlift', 'Overhead Press', 'Barbell Row'];
      var stalled = [];
      mains.forEach(function (lift) {
        var history = [];
        Store.get().workouts.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (w) {
          (w.exercises || []).forEach(function (ex) {
            if (ex.name !== lift) return;
            var best = 0;
            (ex.sets || []).forEach(function (st) {
              best = Math.max(best, Workouts.e1rm(Number(st.weight), Number(st.reps)));
            });
            if (best) history.push({ date: w.date, e1rm: best });
          });
        });
        if (history.length >= 4) {
          var half = Math.floor(history.length / 2);
          var older = avg(history.slice(0, half).map(function (h) { return h.e1rm; }));
          var newer = avg(history.slice(half).map(function (h) { return h.e1rm; }));
          if (newer < older * 0.98) stalled.push(lift);
        }
      });
      if (stalled.length) {
        add(3, '🔁', 'Stalling on ' + stalled.join(', '),
          'Estimated 1RM is drifting down. In a deficit some of this is expected, but first check the cheap fixes: are you sleeping under 7 hours, training these lifts late in the session, or skipping the last rep or two? If not, hold the weight and add one rep per set per week instead of adding load.');
      }

      /* --- long deficit --- */
      if (goalMeta.sign < 0 && s.profile.startWeight && latest) {
        var weeksIn = Store.get().weights.length >= 2
          ? Store.daysBetween(Store.sortedWeights()[0].date, latest.date) / 7
          : 0;
        if (weeksIn >= 12) {
          add(3, '🛑', 'You have been cutting for ' + Math.round(weeksIn) + ' weeks',
            'Long deficits drag down NEAT, training output, sleep, and mood. Consider a 1-2 week break at maintenance calories. It costs almost nothing in fat-loss terms and makes the next block work far better.');
        }
      }

      /* --- projection --- */
      var proj = Coach.projection();
      if (proj) {
        add(4, '🗓️', proj.remaining + ' lbs to go — about ' + proj.weeks + ' weeks',
          'At your current trend you reach ' + s.profile.goalWeight + ' lbs around ' +
          Store.fromKey(proj.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) +
          '. Slower than you would like is normal; the number only moves if the trend does.');
      }

      out.sort(function (a, b) { return a.priority - b.priority; });
      return out;
    }
  };

  global.Coach = Coach;
})(window);
