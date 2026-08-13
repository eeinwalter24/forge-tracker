/* Energy + macro math.

   BMR: Mifflin-St Jeor, the standard predictive equation for people without a
   measured RMR. Every prediction equation carries roughly +/-10% error, so the
   number here is a starting point that the Coach tab corrects using your actual
   weight trend. That feedback loop matters more than the initial estimate. */
(function (global) {
  'use strict';

  var ACTIVITY_LEVELS = [
    { value: 1.25, label: 'Sedentary — desk job, little movement' },
    { value: 1.375, label: 'Light — 1-3 light sessions/wk, some walking' },
    { value: 1.45, label: 'Moderate — 3-4 training days, ~7k steps' },
    { value: 1.55, label: 'Active — 4-5 training days, ~10k steps' },
    { value: 1.7, label: 'Very active — 6+ sessions or physical job' }
  ];

  var GOALS = {
    cut: { label: 'Cut — lose fat', sign: -1 },
    recomp: { label: 'Recomp — slow fat loss, hold muscle', sign: -1 },
    maintain: { label: 'Maintain', sign: 0 },
    lean_bulk: { label: 'Lean bulk — add muscle', sign: 1 }
  };

  var KCAL_PER_LB = 3500;

  var Nutrition = {
    ACTIVITY_LEVELS: ACTIVITY_LEVELS,
    GOALS: GOALS,
    KCAL_PER_LB: KCAL_PER_LB,

    lbsToKg: function (lbs) { return lbs * 0.45359237; },
    inToCm: function (inches) { return inches * 2.54; },

    /* Mifflin-St Jeor, metric internally. */
    bmr: function (profile, weightLbs) {
      var kg = Nutrition.lbsToKg(weightLbs);
      var cm = Nutrition.inToCm(profile.heightIn);
      var base = 10 * kg + 6.25 * cm - 5 * profile.age;
      return Math.round(profile.sex === 'female' ? base - 161 : base + 5);
    },

    tdee: function (profile, weightLbs) {
      return Math.round(Nutrition.bmr(profile, weightLbs) * (profile.activity || 1.45));
    },

    /* Daily calorie target. rateLbsPerWeek is always stored as a positive
       magnitude; the goal decides the direction. */
    calorieTarget: function (profile, weightLbs) {
      var tdee = Nutrition.tdee(profile, weightLbs);
      var goal = GOALS[profile.goal] || GOALS.maintain;
      var rate = Math.abs(profile.rateLbsPerWeek || 0);
      var dailyDelta = goal.sign * (rate * KCAL_PER_LB) / 7;
      var target = Math.round(tdee + dailyDelta);
      // Floor the deficit so the target never lands somewhere unsustainable.
      var floor = profile.sex === 'female' ? 1200 : 1500;
      return Math.max(floor, target);
    },

    /* Protein anchored to bodyweight (~1 g/lb is the practical ceiling for
       muscle retention in a deficit), fat held at a hormonal floor, carbs take
       whatever calories are left over to fuel training. */
    macroTargets: function (profile, weightLbs, kcal) {
      var cutting = (GOALS[profile.goal] || {}).sign < 0;
      var proteinPerLb = cutting ? 1.0 : 0.85;
      var protein = Math.round(weightLbs * proteinPerLb);
      var fat = Math.round(weightLbs * 0.35);
      var remaining = kcal - (protein * 4 + fat * 9);
      var carbs = Math.round(remaining / 4);
      if (carbs < 50) {
        // Deficit too aggressive for this split — shave fat back toward 0.3 g/lb.
        fat = Math.max(Math.round(weightLbs * 0.28), Math.round((kcal - protein * 4 - 50 * 4) / 9));
        carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
      }
      return { kcal: kcal, protein: protein, carbs: Math.max(carbs, 0), fat: fat };
    },

    /* The single entry point views use: resolves manual overrides, then falls
       back to derived numbers off the most recent weigh-in. */
    currentTargets: function () {
      var s = Store.get();
      var latest = Store.latestWeight();
      var weight = latest ? latest.lbs : (s.profile.startWeight || 180);
      if (s.targets && s.targets.kcal) {
        return {
          kcal: s.targets.kcal,
          protein: s.targets.protein,
          carbs: s.targets.carbs,
          fat: s.targets.fat,
          manual: true,
          weight: weight,
          tdee: Nutrition.tdee(s.profile, weight)
        };
      }
      var kcal = Nutrition.calorieTarget(s.profile, weight);
      var m = Nutrition.macroTargets(s.profile, weight, kcal);
      m.manual = false;
      m.weight = weight;
      m.tdee = Nutrition.tdee(s.profile, weight);
      return m;
    },

    /* Sum a day's food entries. */
    totals: function (entries) {
      return entries.reduce(function (acc, e) {
        acc.kcal += e.kcal || 0;
        acc.protein += e.p || 0;
        acc.carbs += e.c || 0;
        acc.fat += e.f || 0;
        return acc;
      }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    },

    /* Scale a food-database item to an arbitrary quantity of its serving unit. */
    scaleFood: function (food, qty) {
      var factor = qty / food.serving;
      return {
        name: food.name,
        qty: qty,
        unit: food.unit,
        kcal: Math.round(food.kcal * factor),
        p: Math.round(food.p * factor * 10) / 10,
        c: Math.round(food.c * factor * 10) / 10,
        f: Math.round(food.f * factor * 10) / 10
      };
    },

    /* Calories a logged session burned, above resting. MET values are coarse by
       nature; treat this as a rough credit, not a measurement. Resistance
       training is ~5 METs, and we subtract 1 MET because the BMR/TDEE estimate
       already accounts for existing at rest during that hour. */
    workoutBurn: function (minutes, weightLbs, met) {
      var kg = Nutrition.lbsToKg(weightLbs);
      var netMet = Math.max((met || 5) - 1, 0);
      return Math.round(netMet * 3.5 * kg / 200 * minutes);
    }
  };

  global.Nutrition = Nutrition;
})(window);
