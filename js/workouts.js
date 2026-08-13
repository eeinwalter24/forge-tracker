/* Exercise library, program templates, and the analysis that turns logged sets
   into signal: estimated 1RM, weekly hard sets per muscle, and PR detection. */
(function (global) {
  'use strict';

  // name, primary muscle, secondary muscles, equipment
  var raw = [
    ['Barbell Back Squat', 'quads', 'glutes,hamstrings,core', 'barbell'],
    ['Front Squat', 'quads', 'core,glutes', 'barbell'],
    ['Goblet Squat', 'quads', 'glutes,core', 'dumbbell'],
    ['Leg Press', 'quads', 'glutes', 'machine'],
    ['Bulgarian Split Squat', 'quads', 'glutes', 'dumbbell'],
    ['Walking Lunge', 'quads', 'glutes', 'dumbbell'],
    ['Leg Extension', 'quads', '', 'machine'],
    ['Conventional Deadlift', 'hamstrings', 'back,glutes,core', 'barbell'],
    ['Romanian Deadlift', 'hamstrings', 'glutes,back', 'barbell'],
    ['Trap Bar Deadlift', 'hamstrings', 'quads,glutes,back', 'barbell'],
    ['Leg Curl', 'hamstrings', '', 'machine'],
    ['Hip Thrust', 'glutes', 'hamstrings', 'barbell'],
    ['Back Extension', 'glutes', 'hamstrings,back', 'bodyweight'],
    ['Calf Raise', 'calves', '', 'machine'],

    ['Barbell Bench Press', 'chest', 'triceps,shoulders', 'barbell'],
    ['Incline Barbell Press', 'chest', 'shoulders,triceps', 'barbell'],
    ['Dumbbell Bench Press', 'chest', 'triceps,shoulders', 'dumbbell'],
    ['Incline Dumbbell Press', 'chest', 'shoulders,triceps', 'dumbbell'],
    ['Machine Chest Press', 'chest', 'triceps', 'machine'],
    ['Cable Fly', 'chest', '', 'cable'],
    ['Push-up', 'chest', 'triceps,core', 'bodyweight'],
    ['Dip', 'chest', 'triceps', 'bodyweight'],

    ['Overhead Press', 'shoulders', 'triceps,core', 'barbell'],
    ['Seated Dumbbell Press', 'shoulders', 'triceps', 'dumbbell'],
    ['Lateral Raise', 'shoulders', '', 'dumbbell'],
    ['Rear Delt Fly', 'shoulders', 'back', 'dumbbell'],
    ['Face Pull', 'shoulders', 'back', 'cable'],

    ['Pull-up', 'back', 'biceps', 'bodyweight'],
    ['Chin-up', 'back', 'biceps', 'bodyweight'],
    ['Lat Pulldown', 'back', 'biceps', 'cable'],
    ['Barbell Row', 'back', 'biceps', 'barbell'],
    ['Dumbbell Row', 'back', 'biceps', 'dumbbell'],
    ['Seated Cable Row', 'back', 'biceps', 'cable'],
    ['Chest-Supported Row', 'back', 'biceps', 'dumbbell'],
    ['Shrug', 'back', '', 'dumbbell'],

    ['Barbell Curl', 'biceps', '', 'barbell'],
    ['Dumbbell Curl', 'biceps', '', 'dumbbell'],
    ['Hammer Curl', 'biceps', 'forearms', 'dumbbell'],
    ['Preacher Curl', 'biceps', '', 'machine'],
    ['Cable Curl', 'biceps', '', 'cable'],

    ['Close-Grip Bench Press', 'triceps', 'chest,shoulders', 'barbell'],
    ['Triceps Pushdown', 'triceps', '', 'cable'],
    ['Overhead Triceps Extension', 'triceps', '', 'dumbbell'],
    ['Skull Crusher', 'triceps', '', 'barbell'],

    ['Plank', 'core', '', 'bodyweight'],
    ['Hanging Leg Raise', 'core', '', 'bodyweight'],
    ['Cable Crunch', 'core', '', 'cable'],
    ['Ab Wheel Rollout', 'core', '', 'bodyweight'],
    ['Pallof Press', 'core', '', 'cable'],

    ['Incline Walk', 'cardio', '', 'cardio'],
    ['Run', 'cardio', '', 'cardio'],
    ['Row Erg', 'cardio', '', 'cardio'],
    ['Assault Bike', 'cardio', '', 'cardio'],
    ['Stair Climber', 'cardio', '', 'cardio'],
    ['Jump Rope', 'cardio', '', 'cardio']
  ];

  var EXERCISES = raw.map(function (r) {
    return {
      name: r[0],
      muscle: r[1],
      secondary: r[2] ? r[2].split(',') : [],
      equipment: r[3]
    };
  });

  var byName = {};
  EXERCISES.forEach(function (e) { byName[e.name] = e; });

  /* Program templates. Each day is a list of [exercise, sets, rep range, notes].
     These are ordinary hypertrophy/strength templates: compound lifts first
     while you're fresh, isolation after, 10-20 hard sets per muscle per week. */
  var PROGRAMS = [
    {
      id: 'upper-lower-4',
      name: 'Upper / Lower — 4 days',
      blurb: 'The default for anyone with 4 training days. Each muscle gets hit twice a week, which beats once-a-week splits for both strength and size.',
      days: [
        {
          name: 'Upper A (strength bias)',
          items: [
            ['Barbell Bench Press', 4, '5-6', 'Leave 1-2 reps in reserve on the first 3 sets'],
            ['Barbell Row', 4, '6-8', 'Chest stays down, no body english'],
            ['Seated Dumbbell Press', 3, '8-10', ''],
            ['Lat Pulldown', 3, '10-12', ''],
            ['Triceps Pushdown', 3, '12-15', ''],
            ['Hammer Curl', 3, '10-12', '']
          ]
        },
        {
          name: 'Lower A (squat bias)',
          items: [
            ['Barbell Back Squat', 4, '5-6', 'Depth over load'],
            ['Romanian Deadlift', 3, '8-10', 'Hinge, do not squat it'],
            ['Leg Press', 3, '10-12', ''],
            ['Leg Curl', 3, '12-15', ''],
            ['Calf Raise', 4, '12-15', ''],
            ['Hanging Leg Raise', 3, '10-15', '']
          ]
        },
        {
          name: 'Upper B (hypertrophy bias)',
          items: [
            ['Incline Dumbbell Press', 4, '8-10', ''],
            ['Pull-up', 4, 'AMRAP', 'Add weight once you clear 10 clean reps'],
            ['Chest-Supported Row', 3, '10-12', ''],
            ['Lateral Raise', 4, '12-20', 'Light. This is the delt width lift'],
            ['Cable Fly', 3, '12-15', ''],
            ['Cable Curl', 3, '12-15', ''],
            ['Face Pull', 3, '15-20', 'Shoulder insurance — do not skip']
          ]
        },
        {
          name: 'Lower B (hinge bias)',
          items: [
            ['Trap Bar Deadlift', 4, '5-6', ''],
            ['Bulgarian Split Squat', 3, '8-10 ea', 'Brutal but unmatched for legs'],
            ['Leg Extension', 3, '12-15', ''],
            ['Back Extension', 3, '12-15', ''],
            ['Calf Raise', 4, '12-15', ''],
            ['Cable Crunch', 3, '12-15', '']
          ]
        }
      ]
    },
    {
      id: 'full-body-3',
      name: 'Full Body — 3 days',
      blurb: 'Best return per hour when time is tight. Every session touches every major pattern: squat, hinge, push, pull.',
      days: [
        {
          name: 'Full Body A',
          items: [
            ['Barbell Back Squat', 3, '5-8', ''],
            ['Barbell Bench Press', 3, '5-8', ''],
            ['Barbell Row', 3, '8-10', ''],
            ['Romanian Deadlift', 2, '10-12', ''],
            ['Lateral Raise', 3, '12-20', ''],
            ['Plank', 3, '45-60s', '']
          ]
        },
        {
          name: 'Full Body B',
          items: [
            ['Trap Bar Deadlift', 3, '5-6', ''],
            ['Incline Dumbbell Press', 3, '8-10', ''],
            ['Lat Pulldown', 3, '10-12', ''],
            ['Walking Lunge', 3, '10-12 ea', ''],
            ['Hammer Curl', 3, '10-12', ''],
            ['Hanging Leg Raise', 3, '10-15', '']
          ]
        },
        {
          name: 'Full Body C',
          items: [
            ['Front Squat', 3, '6-8', ''],
            ['Overhead Press', 3, '6-8', ''],
            ['Chin-up', 3, 'AMRAP', ''],
            ['Leg Curl', 3, '12-15', ''],
            ['Cable Fly', 3, '12-15', ''],
            ['Triceps Pushdown', 3, '12-15', '']
          ]
        }
      ]
    },
    {
      id: 'ppl-5',
      name: 'Push / Pull / Legs — 5 days',
      blurb: 'More volume, more days. Only worth it once sleep and food are consistently handled — otherwise the extra sessions just add fatigue.',
      days: [
        {
          name: 'Push',
          items: [
            ['Barbell Bench Press', 4, '6-8', ''],
            ['Seated Dumbbell Press', 3, '8-10', ''],
            ['Incline Dumbbell Press', 3, '10-12', ''],
            ['Lateral Raise', 4, '12-20', ''],
            ['Triceps Pushdown', 3, '12-15', ''],
            ['Overhead Triceps Extension', 3, '12-15', '']
          ]
        },
        {
          name: 'Pull',
          items: [
            ['Barbell Row', 4, '6-8', ''],
            ['Pull-up', 4, 'AMRAP', ''],
            ['Seated Cable Row', 3, '10-12', ''],
            ['Rear Delt Fly', 3, '15-20', ''],
            ['Barbell Curl', 3, '8-10', ''],
            ['Hammer Curl', 3, '12-15', '']
          ]
        },
        {
          name: 'Legs',
          items: [
            ['Barbell Back Squat', 4, '5-8', ''],
            ['Romanian Deadlift', 3, '8-10', ''],
            ['Leg Press', 3, '10-12', ''],
            ['Leg Curl', 3, '12-15', ''],
            ['Calf Raise', 4, '12-15', ''],
            ['Cable Crunch', 3, '12-15', '']
          ]
        },
        {
          name: 'Upper (pump)',
          items: [
            ['Incline Dumbbell Press', 4, '10-12', ''],
            ['Chest-Supported Row', 4, '10-12', ''],
            ['Machine Chest Press', 3, '12-15', ''],
            ['Lat Pulldown', 3, '12-15', ''],
            ['Lateral Raise', 4, '15-20', ''],
            ['Cable Curl', 3, '12-15', ''],
            ['Face Pull', 3, '15-20', '']
          ]
        },
        {
          name: 'Lower + conditioning',
          items: [
            ['Bulgarian Split Squat', 3, '10-12 ea', ''],
            ['Hip Thrust', 3, '10-12', ''],
            ['Leg Extension', 3, '15-20', ''],
            ['Back Extension', 3, '12-15', ''],
            ['Incline Walk', 1, '20 min', 'Steady, nose-breathing pace']
          ]
        }
      ]
    }
  ];

  var MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'];

  // Evidence-backed working range for hypertrophy, per muscle per week.
  var WEEKLY_SET_TARGET = { min: 10, max: 20 };

  var Workouts = {
    EXERCISES: EXERCISES,
    PROGRAMS: PROGRAMS,
    MUSCLES: MUSCLES,
    WEEKLY_SET_TARGET: WEEKLY_SET_TARGET,

    find: function (name) { return byName[name] || null; },

    program: function (id) {
      return PROGRAMS.filter(function (p) { return p.id === id; })[0] || null;
    },

    search: function (query, limit) {
      var q = (query || '').trim().toLowerCase();
      if (!q) return EXERCISES.slice(0, limit || 20);
      return EXERCISES.filter(function (e) {
        return e.name.toLowerCase().indexOf(q) > -1 ||
               e.muscle.indexOf(q) > -1 ||
               e.equipment.indexOf(q) > -1;
      }).slice(0, limit || 20);
    },

    /* Epley. Accurate enough under ~10 reps; above that it drifts optimistic,
       so we cap the reps we'll extrapolate from. */
    e1rm: function (weight, reps) {
      if (!weight || !reps) return 0;
      var r = Math.min(reps, 12);
      return Math.round(weight * (1 + r / 30));
    },

    setVolume: function (set) {
      return (Number(set.weight) || 0) * (Number(set.reps) || 0);
    },

    workoutVolume: function (workout) {
      var total = 0;
      (workout.exercises || []).forEach(function (ex) {
        (ex.sets || []).forEach(function (s) { total += Workouts.setVolume(s); });
      });
      return Math.round(total);
    },

    /* A "hard set" here is any logged working set with reps. Sets that train a
       muscle indirectly (secondary movers) count as half, which is the usual
       convention for volume landmarks. */
    weeklySetsByMuscle: function (sinceDateKey) {
      var counts = {};
      MUSCLES.forEach(function (m) { counts[m] = 0; });
      Store.get().workouts.forEach(function (w) {
        if (sinceDateKey && w.date < sinceDateKey) return;
        (w.exercises || []).forEach(function (ex) {
          var meta = byName[ex.name];
          if (!meta || meta.muscle === 'cardio') return;
          var working = (ex.sets || []).filter(function (s) { return Number(s.reps) > 0; }).length;
          if (!working) return;
          if (counts[meta.muscle] !== undefined) counts[meta.muscle] += working;
          meta.secondary.forEach(function (m) {
            if (counts[m] !== undefined) counts[m] += working * 0.5;
          });
        });
      });
      return counts;
    },

    /* Best estimated 1RM ever recorded for an exercise, excluding one workout
       (used to ask "is the set I'm entering right now a PR?"). */
    bestE1rm: function (exerciseName, excludeWorkoutId) {
      var best = 0;
      Store.get().workouts.forEach(function (w) {
        if (excludeWorkoutId && w.id === excludeWorkoutId) return;
        (w.exercises || []).forEach(function (ex) {
          if (ex.name !== exerciseName) return;
          (ex.sets || []).forEach(function (s) {
            var e = Workouts.e1rm(Number(s.weight), Number(s.reps));
            if (e > best) best = e;
          });
        });
      });
      return best;
    },

    /* Last time this exercise was trained, for on-screen "last session" recall. */
    lastPerformance: function (exerciseName, excludeWorkoutId) {
      var sorted = Store.workoutsSorted();
      for (var i = 0; i < sorted.length; i++) {
        var w = sorted[i];
        if (excludeWorkoutId && w.id === excludeWorkoutId) continue;
        var match = (w.exercises || []).filter(function (ex) { return ex.name === exerciseName; })[0];
        if (match && (match.sets || []).length) {
          return { date: w.date, sets: match.sets };
        }
      }
      return null;
    },

    /* Total tonnage per ISO week, oldest first — the Progress tab's bar chart. */
    volumeByWeek: function (weeks) {
      var out = [];
      var today = Store.today();
      for (var i = weeks - 1; i >= 0; i--) {
        var end = Store.addDays(today, -7 * i);
        var start = Store.addDays(end, -6);
        var vol = 0, sessions = 0;
        Store.get().workouts.forEach(function (w) {
          if (w.date >= start && w.date <= end) {
            vol += Workouts.workoutVolume(w);
            sessions++;
          }
        });
        out.push({ start: start, end: end, volume: vol, sessions: sessions });
      }
      return out;
    },

    /* Build a blank logged workout from a program day. */
    fromTemplate: function (programId, dayIndex) {
      var prog = Workouts.program(programId);
      if (!prog) return null;
      var day = prog.days[dayIndex];
      return {
        id: Store.newId(),
        date: Store.today(),
        name: day.name,
        program: programId,
        notes: '',
        exercises: day.items.map(function (it) {
          var sets = [];
          for (var i = 0; i < it[1]; i++) sets.push({ weight: '', reps: '' });
          return { name: it[0], target: it[2], note: it[3] || '', sets: sets };
        })
      };
    }
  };

  global.Workouts = Workouts;
})(window);
