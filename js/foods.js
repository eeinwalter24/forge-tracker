/* Built-in food database.

   Values are per the stated serving size and come from standard USDA reference
   figures, rounded. They are close enough for calorie tracking, which only
   needs to be consistent — a 5% error applied the same way every day still
   produces a usable trend. Add your own in the Food tab for anything missing. */
(function (global) {
  'use strict';

  // name, unit, serving, kcal, protein, carbs, fat, tags
  var raw = [
    // --- lean protein ---
    ['Chicken breast, grilled', 'oz', 4, 187, 35, 0, 4, 'protein meat'],
    ['Chicken thigh, boneless skinless', 'oz', 4, 209, 26, 0, 11, 'protein meat'],
    ['Ground turkey 93/7, cooked', 'oz', 4, 200, 27, 0, 10, 'protein meat'],
    ['Ground beef 90/10, cooked', 'oz', 4, 231, 30, 0, 12, 'protein meat'],
    ['Ground beef 80/20, cooked', 'oz', 4, 287, 26, 0, 20, 'protein meat'],
    ['Sirloin steak, lean', 'oz', 4, 206, 33, 0, 8, 'protein meat'],
    ['Ribeye steak', 'oz', 4, 320, 27, 0, 24, 'protein meat'],
    ['Pork tenderloin', 'oz', 4, 165, 30, 0, 4, 'protein meat'],
    ['Bacon, cooked', 'slice', 1, 43, 3, 0, 3.3, 'protein meat'],
    ['Salmon, baked', 'oz', 4, 233, 25, 0, 14, 'protein fish'],
    ['Tilapia / white fish', 'oz', 4, 145, 30, 0, 3, 'protein fish'],
    ['Tuna, canned in water', 'can', 1, 121, 27, 0, 1, 'protein fish'],
    ['Shrimp, cooked', 'oz', 4, 112, 24, 0, 1, 'protein fish'],
    ['Egg, large whole', 'egg', 1, 72, 6.3, 0.4, 5, 'protein breakfast'],
    ['Egg white, large', 'egg', 1, 17, 3.6, 0.2, 0, 'protein breakfast'],
    ['Liquid egg whites', 'cup', 1, 126, 26, 2, 0, 'protein breakfast'],
    ['Whey protein powder', 'scoop', 1, 120, 24, 3, 1.5, 'protein supplement'],
    ['Casein protein powder', 'scoop', 1, 120, 24, 3, 1, 'protein supplement'],
    ['Greek yogurt, nonfat plain', 'cup', 1, 146, 25, 9, 0.9, 'protein dairy'],
    ['Greek yogurt, 2% plain', 'cup', 1, 173, 24, 9, 4.8, 'protein dairy'],
    ['Cottage cheese, 2%', 'cup', 1, 183, 24, 9, 5, 'protein dairy'],
    ['Skyr / high-protein yogurt cup', 'cup', 1, 130, 20, 10, 0, 'protein dairy'],
    ['Deli turkey breast', 'oz', 2, 60, 11, 2, 1, 'protein meat'],
    ['Rotisserie chicken, meat only', 'oz', 4, 208, 30, 0, 9, 'protein meat'],
    ['Tofu, firm', 'oz', 4, 94, 10, 2, 6, 'protein vegetarian'],
    ['Tempeh', 'oz', 4, 223, 21, 8, 13, 'protein vegetarian'],
    ['Protein bar (typical 20g)', 'bar', 1, 210, 20, 22, 7, 'protein snack'],

    // --- carbs / grains ---
    ['White rice, cooked', 'cup', 1, 205, 4.3, 45, 0.4, 'carb grain'],
    ['Brown rice, cooked', 'cup', 1, 216, 5, 45, 1.8, 'carb grain'],
    ['Jasmine rice, cooked', 'cup', 1, 205, 4, 45, 0.4, 'carb grain'],
    ['Quinoa, cooked', 'cup', 1, 222, 8, 39, 3.6, 'carb grain'],
    ['Pasta, cooked', 'cup', 1, 221, 8, 43, 1.3, 'carb grain'],
    ['Oats, dry rolled', 'cup', 0.5, 150, 5, 27, 3, 'carb grain breakfast'],
    ['Bread, whole wheat', 'slice', 1, 81, 4, 14, 1.1, 'carb grain'],
    ['Bread, white', 'slice', 1, 77, 2.6, 14, 1, 'carb grain'],
    ['Bagel, plain', 'bagel', 1, 289, 11, 56, 1.7, 'carb grain'],
    ['Tortilla, flour 8in', 'each', 1, 144, 4, 24, 3.5, 'carb grain'],
    ['Tortilla, corn 6in', 'each', 1, 52, 1.4, 11, 0.7, 'carb grain'],
    ['Potato, baked with skin', 'medium', 1, 161, 4.3, 37, 0.2, 'carb veg'],
    ['Sweet potato, baked', 'medium', 1, 112, 2, 26, 0.1, 'carb veg'],
    ['Cereal, generic sweetened', 'cup', 1, 130, 2, 29, 1.5, 'carb breakfast'],
    ['Pancake, 4in', 'each', 1, 86, 2.4, 11, 3.5, 'carb breakfast'],
    ['English muffin', 'each', 1, 134, 4.4, 26, 1, 'carb grain'],
    ['Rice cake', 'each', 1, 35, 0.7, 7.3, 0.3, 'carb snack'],
    ['Granola', 'cup', 0.5, 240, 6, 33, 10, 'carb breakfast'],

    // --- fruit ---
    ['Banana, medium', 'each', 1, 105, 1.3, 27, 0.4, 'fruit'],
    ['Apple, medium', 'each', 1, 95, 0.5, 25, 0.3, 'fruit'],
    ['Orange, medium', 'each', 1, 62, 1.2, 15, 0.2, 'fruit'],
    ['Blueberries', 'cup', 1, 84, 1.1, 21, 0.5, 'fruit'],
    ['Strawberries', 'cup', 1, 49, 1, 12, 0.5, 'fruit'],
    ['Grapes', 'cup', 1, 104, 1.1, 27, 0.2, 'fruit'],
    ['Pineapple, chunks', 'cup', 1, 83, 0.9, 22, 0.2, 'fruit'],
    ['Avocado, medium', 'each', 1, 240, 3, 13, 22, 'fruit fat'],
    ['Watermelon, diced', 'cup', 1, 46, 0.9, 12, 0.2, 'fruit'],
    ['Mango, diced', 'cup', 1, 99, 1.4, 25, 0.6, 'fruit'],

    // --- vegetables ---
    ['Broccoli, cooked', 'cup', 1, 55, 3.7, 11, 0.6, 'veg'],
    ['Spinach, raw', 'cup', 1, 7, 0.9, 1.1, 0.1, 'veg'],
    ['Mixed salad greens', 'cup', 2, 15, 1.4, 2.9, 0.2, 'veg'],
    ['Green beans, cooked', 'cup', 1, 44, 2.4, 10, 0.4, 'veg'],
    ['Asparagus, cooked', 'cup', 1, 40, 4.3, 7.4, 0.4, 'veg'],
    ['Bell pepper', 'each', 1, 31, 1, 7, 0.3, 'veg'],
    ['Carrots, baby', 'oz', 3, 30, 0.6, 7, 0.1, 'veg'],
    ['Onion, chopped', 'cup', 1, 64, 1.8, 15, 0.2, 'veg'],
    ['Brussels sprouts, roasted', 'cup', 1, 78, 4, 11, 3, 'veg'],
    ['Cauliflower rice', 'cup', 1, 25, 2, 5, 0.3, 'veg'],
    ['Mushrooms, sliced', 'cup', 1, 15, 2.2, 2.3, 0.2, 'veg'],
    ['Zucchini, cooked', 'cup', 1, 27, 2, 4.8, 0.7, 'veg'],

    // --- fats / nuts ---
    ['Olive oil', 'tbsp', 1, 119, 0, 0, 13.5, 'fat oil'],
    ['Butter', 'tbsp', 1, 102, 0.1, 0, 11.5, 'fat'],
    ['Cooking spray, 1s spray', 'spray', 1, 5, 0, 0, 0.5, 'fat oil'],
    ['Peanut butter', 'tbsp', 1, 94, 4, 3.5, 8, 'fat nut'],
    ['Almonds', 'oz', 1, 164, 6, 6, 14, 'fat nut'],
    ['Walnuts', 'oz', 1, 185, 4.3, 3.9, 18.5, 'fat nut'],
    ['Cashews', 'oz', 1, 157, 5, 9, 12, 'fat nut'],
    ['Chia seeds', 'tbsp', 1, 58, 2, 5, 3.7, 'fat seed'],
    ['Mayonnaise', 'tbsp', 1, 94, 0.1, 0.1, 10, 'fat condiment'],
    ['Ranch dressing', 'tbsp', 2, 129, 0.4, 1.8, 13.4, 'fat condiment'],

    // --- dairy / drinks ---
    ['Milk, whole', 'cup', 1, 149, 8, 12, 8, 'dairy drink'],
    ['Milk, skim', 'cup', 1, 83, 8, 12, 0.2, 'dairy drink'],
    ['Almond milk, unsweetened', 'cup', 1, 30, 1, 1, 2.5, 'dairy drink'],
    ['Cheddar cheese', 'oz', 1, 114, 7, 0.4, 9, 'dairy'],
    ['Mozzarella, part skim', 'oz', 1, 85, 7, 0.6, 6, 'dairy'],
    ['String cheese', 'stick', 1, 80, 6, 1, 6, 'dairy snack'],
    ['Cream cheese', 'tbsp', 1, 51, 0.9, 0.8, 5, 'dairy'],
    ['Half and half', 'tbsp', 1, 20, 0.4, 0.6, 1.7, 'dairy'],
    ['Coffee, black', 'cup', 1, 2, 0.3, 0, 0, 'drink'],
    ['Beer, regular 12oz', 'each', 1, 153, 1.6, 13, 0, 'drink alcohol'],
    ['Beer, light 12oz', 'each', 1, 103, 0.9, 5.8, 0, 'drink alcohol'],
    ['Wine, red 5oz', 'glass', 1, 125, 0.1, 3.8, 0, 'drink alcohol'],
    ['Liquor, 1.5oz shot', 'shot', 1, 97, 0, 0, 0, 'drink alcohol'],
    ['Soda, regular 12oz', 'each', 1, 140, 0, 39, 0, 'drink'],
    ['Diet soda', 'each', 1, 0, 0, 0, 0, 'drink'],
    ['Sports drink, 20oz', 'each', 1, 130, 0, 34, 0, 'drink'],
    ['Orange juice', 'cup', 1, 112, 1.7, 26, 0.5, 'drink'],

    // --- restaurant / convenience ---
    ['Cheeseburger, fast food', 'each', 1, 535, 27, 39, 28, 'meal restaurant'],
    ['French fries, medium', 'each', 1, 365, 4, 48, 17, 'restaurant'],
    ['Pizza, cheese slice', 'slice', 1, 285, 12, 36, 10, 'meal restaurant'],
    ['Burrito bowl, chicken + rice + beans', 'each', 1, 665, 45, 78, 18, 'meal restaurant'],
    ['Chicken sandwich, fried', 'each', 1, 540, 28, 47, 27, 'meal restaurant'],
    ['Caesar salad with chicken', 'each', 1, 470, 34, 12, 32, 'meal restaurant'],
    ['Sushi roll, salmon avocado', 'roll', 1, 304, 13, 42, 9, 'meal restaurant'],
    ['Chinese takeout, orange chicken', 'cup', 1, 490, 24, 51, 22, 'meal restaurant'],
    ['Breakfast burrito', 'each', 1, 480, 22, 42, 25, 'meal restaurant'],

    // --- snacks / sweets ---
    ['Potato chips', 'oz', 1, 152, 2, 15, 10, 'snack'],
    ['Tortilla chips', 'oz', 1, 140, 2, 19, 7, 'snack'],
    ['Popcorn, air popped', 'cup', 3, 93, 3, 19, 1.1, 'snack'],
    ['Ice cream, vanilla', 'cup', 0.5, 210, 3.5, 24, 11, 'snack sweet'],
    ['Chocolate chip cookie', 'each', 1, 78, 0.9, 10, 4, 'snack sweet'],
    ['Brownie', 'each', 1, 227, 2.7, 36, 9, 'snack sweet'],
    ['Dark chocolate', 'oz', 1, 155, 2, 13, 11, 'snack sweet'],
    ['Candy bar, standard', 'each', 1, 250, 3.5, 33, 12, 'snack sweet'],
    ['Beef jerky', 'oz', 1, 116, 9.4, 3.1, 7.3, 'snack protein'],
    ['Hummus', 'tbsp', 2, 70, 2, 6, 5, 'snack'],
    ['Pretzels', 'oz', 1, 108, 2.9, 22, 0.8, 'snack'],

    // --- legumes ---
    ['Black beans, cooked', 'cup', 1, 227, 15, 41, 0.9, 'carb legume'],
    ['Chickpeas, cooked', 'cup', 1, 269, 15, 45, 4.2, 'carb legume'],
    ['Lentils, cooked', 'cup', 1, 230, 18, 40, 0.8, 'carb legume'],
    ['Edamame, shelled', 'cup', 1, 188, 18, 14, 8, 'protein legume'],

    // --- condiments ---
    ['Ketchup', 'tbsp', 1, 19, 0.2, 5, 0, 'condiment'],
    ['Mustard', 'tsp', 1, 3, 0.2, 0.3, 0.2, 'condiment'],
    ['Hot sauce', 'tsp', 1, 1, 0, 0.1, 0, 'condiment'],
    ['BBQ sauce', 'tbsp', 1, 29, 0, 7, 0.1, 'condiment'],
    ['Soy sauce', 'tbsp', 1, 9, 1.3, 0.8, 0, 'condiment'],
    ['Salsa', 'tbsp', 2, 10, 0.5, 2, 0, 'condiment'],
    ['Honey', 'tbsp', 1, 64, 0.1, 17, 0, 'condiment sweet'],
    ['Maple syrup', 'tbsp', 1, 52, 0, 13, 0, 'condiment sweet'],
    ['Sugar, granulated', 'tsp', 1, 16, 0, 4.2, 0, 'condiment sweet']
  ];

  var FOODS = raw.map(function (r) {
    return {
      name: r[0], unit: r[1], serving: r[2],
      kcal: r[3], p: r[4], c: r[5], f: r[6],
      tags: r[7], builtin: true
    };
  });

  var Foods = {
    all: function () {
      return FOODS.concat(Store.get().customFoods || []);
    },

    /* Ranked substring search: name-prefix beats word-start beats anywhere. */
    search: function (query, limit) {
      var q = (query || '').trim().toLowerCase();
      if (!q) return [];
      var scored = [];
      Foods.all().forEach(function (f) {
        var name = f.name.toLowerCase();
        var score = -1;
        if (name.indexOf(q) === 0) score = 0;
        else if (new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(name)) score = 1;
        else if (name.indexOf(q) > -1) score = 2;
        else if ((f.tags || '').indexOf(q) > -1) score = 3;
        if (score >= 0) scored.push({ food: f, score: score });
      });
      scored.sort(function (a, b) {
        if (a.score !== b.score) return a.score - b.score;
        return a.food.name.length - b.food.name.length;
      });
      return scored.slice(0, limit || 25).map(function (s) { return s.food; });
    },

    /* Foods you've logged most often, so repeat meals are one tap away. */
    frequent: function (limit) {
      var counts = {};
      var food = Store.get().food;
      Object.keys(food).forEach(function (day) {
        food[day].forEach(function (e) {
          counts[e.name] = (counts[e.name] || 0) + 1;
        });
      });
      var byName = {};
      Foods.all().forEach(function (f) { byName[f.name] = f; });
      return Object.keys(counts)
        .sort(function (a, b) { return counts[b] - counts[a]; })
        .map(function (n) { return byName[n]; })
        .filter(Boolean)
        .slice(0, limit || 8);
    }
  };

  global.Foods = Foods;
})(window);
