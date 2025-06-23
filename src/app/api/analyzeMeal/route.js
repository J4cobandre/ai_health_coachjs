import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Nutritionix API config ---
const NUTRITIONIX_APP_ID = process.env.NUTRITIONIX_APP_ID;
const NUTRITIONIX_APP_KEY = process.env.NUTRITIONIX_APP_KEY;
const NUTRITIONIX_API_URL = 'https://trackapi.nutritionix.com/v2/natural/nutrients';

// --- Common food synonyms and variations ---
const FOOD_SYNONYMS = {
  'protein': ['protein shake', 'protein powder', 'whey protein', 'protein drink'],
  'oats': ['oatmeal', 'porridge'],
  'milk': ['dairy milk', 'whole milk', 'skim milk'],
  'banana': ['bananas'],
  'apple': ['gala apple', 'red apple', 'green apple'],
  'coffee': ['espresso', 'americano'],
  'tea': ['green tea', 'black tea', 'iced tea'],
  'rice': ['white rice', 'brown rice'],
  'chicken': ['chicken breast', 'chicken thigh', 'chicken meat'],
  'eggs': ['egg'],
};

// Add this near the top, after FOOD_SYNONYMS
const SERVING_FOODS = [
  'spaghetti', 'pasta', 'noodles', 'rice', 'soup', 'salad', 'cereal', 'stew', 'lasagna', 'macaroni', 'ramen', 'udon', 'pho', 'risotto', 'paella', 'couscous', 'quinoa', 'chili', 'porridge', 'gumbo', 'jambalaya', 'gnocchi', 'fettuccine', 'tagliatelle', 'vermicelli', 'penne', 'ziti', 'linguine', 'farfalle', 'orzo', 'fusilli', 'bowls', 'plates', 'servings'
];

// --- Helper: Normalize food names for robust matching ---
function normalizeFoodName(food) {
  if (!food) return '';
  // Convert to lowercase and remove extra spaces
  let name = food.toLowerCase().trim();
  
  // Remove common prefixes/suffixes that don't affect meaning
  name = name.replace(/^(a |an |the |some |fresh |raw |cooked |prepared |made )/, '');
  name = name.replace(/(s|es|ies)$/, ''); // Remove plurals
  
  // Check for synonyms
  for (const [base, variations] of Object.entries(FOOD_SYNONYMS)) {
    if (variations.some(v => name.includes(v)) || name.includes(base)) {
      return base;
    }
  }
  
  return name;
}

// --- Helper: Check if two food names match (including partial matches) ---
function foodNamesMatch(food1, food2) {
  const norm1 = normalizeFoodName(food1);
  const norm2 = normalizeFoodName(food2);
  
  // Direct match after normalization
  if (norm1 === norm2) return true;
  
  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  // Check synonyms
  for (const [base, variations] of Object.entries(FOOD_SYNONYMS)) {
    const isFood1Match = variations.some(v => norm1.includes(v)) || norm1.includes(base);
    const isFood2Match = variations.some(v => norm2.includes(v)) || norm2.includes(base);
    if (isFood1Match && isFood2Match) return true;
  }
  
  return false;
}

// --- Helper: Check if all missing foods have been clarified ---
function allFoodsClarified(missingFoods, clarifiedFoods) {
  if (!missingFoods || missingFoods.length === 0) return true;
  if (!clarifiedFoods || clarifiedFoods.length === 0) return false;
  
  return missingFoods.every(missing => {
    if (!missing) return true; // Skip empty entries
    
    return clarifiedFoods.some(clarified => {
      if (!clarified) return false;
      
      // Accept if clarified food is a synonym, subtype, or contains the missing food
      const clarifiedName = clarified.food || clarified.originalFood || '';
      if (foodNamesMatch(missing, clarifiedName)) return true;
      
      // Accept if clarified food is a subtype/variation of the missing food (e.g., 'chicken thigh' for 'chicken')
      const normMissing = normalizeFoodName(missing);
      const normClarified = normalizeFoodName(clarifiedName);
      if (normClarified.includes(normMissing) || normMissing.includes(normClarified)) return true;
      
      // Accept if clarified quantity is present and not vague (e.g., '1 thigh', '2 breasts')
      if (clarified.quantity && clarified.quantity.match(/\d/)) return true;
      
      return false;
    });
  });
}

// --- Helper: Merge duplicate foods ---
function mergeDuplicates(breakdown) {
  if (!breakdown || breakdown.length === 0) return [];
  
  const merged = {};
  breakdown.forEach(item => {
    if (!item || !item.food) return; // Skip invalid items
    
    const key = normalizeFoodName(item.food);
    if (!key) return; // Skip items that can't be normalized
    
    if (!merged[key]) {
      merged[key] = { ...item };
    } else {
      // Merge calories safely
      merged[key].calories = (merged[key].calories || 0) + (item.calories || 0);
      
      // Merge quantities intelligently
      if (item.quantity && merged[key].quantity) {
        const prevQty = merged[key].quantity.toString();
        const currQty = item.quantity.toString();
        
        if (prevQty.match(/^\d+(\.\d+)?/) && currQty.match(/^\d+(\.\d+)?/)) {
          // If both quantities are numeric, try to add them
          const num1 = parseFloat(prevQty);
          const num2 = parseFloat(currQty);
          if (!isNaN(num1) && !isNaN(num2)) {
            merged[key].quantity = `${num1 + num2}`;
          } else {
            merged[key].quantity = `${prevQty} + ${currQty}`;
          }
        } else {
          merged[key].quantity = `${prevQty} + ${currQty}`;
        }
      } else if (item.quantity) {
        merged[key].quantity = item.quantity;
      }
      
      // Merge meal times
      if (item.mealTime && !merged[key].mealTime) {
        merged[key].mealTime = item.mealTime;
      }
      
      // Merge notes
      if (item.notes) {
        if (merged[key].notes) {
          merged[key].notes += '; ' + item.notes;
        } else {
          merged[key].notes = item.notes;
        }
      }
    }
  });
  
  return Object.values(merged).filter(item => item && item.food); // Filter out any invalid results
}

// --- Helper: Parse date from message ---
function parseDateFromMessage(message) {
  const lower = message.toLowerCase();
  if (lower.includes('yesterday')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  // Add more NLP for other temporal references if needed
  return null; // Default to today if not found
}

// --- Helper: Nutritionix API call ---
async function analyzeWithNutritionix(message) {
  if (!NUTRITIONIX_APP_ID || !NUTRITIONIX_APP_KEY) {
    throw new Error('Nutritionix credentials not configured');
  }
  const response = await fetch(NUTRITIONIX_API_URL, {
    method: 'POST',
    headers: {
      'x-app-id': NUTRITIONIX_APP_ID,
      'x-app-key': NUTRITIONIX_APP_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: message }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nutritionix API error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  return response.json();
}

// --- GPT-4: Clarify food entries, units, types, and temporal context ---
async function clarifyFoodEntries(message) {
  const clarificationPrompt = `
You are a nutrition assistant. Your job is to clarify vague food entries into specific, measurable quantities suitable for nutrition analysis, and to detect temporal references (e.g., 'yesterday', 'for breakfast', 'after gym').

1. For each food in the user's message, output a list of objects: { food, quantity, notes, mealTime }
2. If any food is missing a quantity, unit, or type, do NOT guess. Instead, return a clarification prompt.
3. If the user says "a" or "an" before a food (e.g., "a banana"), treat it as "1" (do not ask for clarification).
4. If any food is a duplicate or synonym, merge them and sum the quantities if possible.
5. If any entry is not a food, exclude it and add a note.
6. If the message contains a temporal reference, include it in mealTime.
7. If all foods are clear, return the clarified list only.

User message: "${message}"

Respond in this JSON format:
{
  "clarified": [ { "food": string, "quantity": string, "notes": string, "mealTime": string } ],
  "missing": [ ...foods missing info... ],
  "clarificationPrompt": "your clarification question here, or null if all foods are clear",
  "date": "YYYY-MM-DD or null"
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a nutrition assistant. Always return a valid JSON object as described. Be conservative - if a food lacks clear quantity, mark it as missing."
        },
        {
          role: "user",
          content: clarificationPrompt
        }
      ],
      temperature: 0.1,
      max_tokens: 700,
    });

    let response = completion.choices[0]?.message?.content?.trim() || "";
    
    // Clean up the response to extract JSON
    if (response.startsWith("```json")) {
      response = response.replace(/```json\s*/, "").replace(/\s*```/, "");
    } else if (response.startsWith("```")) {
      response = response.replace(/```\s*/, "").replace(/\s*```/, "");
    }
    response = response.trim();

    // Attempt to parse JSON with better error handling
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch (parseError) {
      console.error('JSON parse error in clarifyFoodEntries:', parseError, 'Response was:', response);
      // Return a fallback response that requests clarification
      return {
        clarified: [],
        missing: [message],
        clarificationPrompt: "I couldn't understand your food entry. Please specify what you ate with clear quantities (e.g., '2 slices pizza', '1 cup rice').",
        date: null,
      };
    }

    return {
      clarified: parsed.clarified || [],
      missing: parsed.missing || [],
      clarificationPrompt: parsed.clarificationPrompt || null,
      date: parsed.date || null,
    };
  } catch (error) {
    console.error('Error in clarifyFoodEntries:', error);
    throw new Error('Failed to clarify food entries');
  }
}

// --- Parse user's clarification into structured food objects using GPT ---
async function parseClarificationFoods(clarificationText, missingFoods) {
  const prompt = `
You are a nutrition assistant. Parse the following user clarification into a list of food objects with food name and quantity. Match these with the original missing foods if possible.

Original missing foods: ${JSON.stringify(missingFoods)}
User clarification: "${clarificationText}"

For example:
Missing: ["protein shake", "oats"]
Input: "1 scoop protein and 1 cup oatmeal"
Should match: [
  { "food": "protein shake", "quantity": "1 scoop" },
  { "food": "oats", "quantity": "1 cup" }
]

Respond in this JSON format:
[
  { "food": string, "quantity": string, "originalFood": string }
]

Note: originalFood should match one of the missing foods if possible.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a nutrition assistant. Always return a valid JSON array as described. Extract food name and quantity from the user's clarification." 
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    let response = completion.choices[0]?.message?.content?.trim() || "";
    
    // Clean up the response to extract JSON
    if (response.startsWith("```json")) {
      response = response.replace(/```json\s*/, "").replace(/\s*```/, "");
    } else if (response.startsWith("```")) {
      response = response.replace(/```\s*/, "").replace(/\s*```/, "");
    }
    response = response.trim();

    try {
      const parsed = JSON.parse(response);
      if (!Array.isArray(parsed)) {
        console.error('parseClarificationFoods: Expected array but got:', typeof parsed);
        throw new Error('Expected array response');
      }
      return parsed;
    } catch (parseError) {
      console.error('JSON parse error in parseClarificationFoods:', parseError, 'Response was:', response);
      // Fallback: create a simple mapping
      return missingFoods.map(food => ({
        food: food,
        quantity: "1", // Default quantity
        originalFood: food
      }));
    }
  } catch (error) {
    console.error('Error in parseClarificationFoods:', error);
    throw new Error('Failed to parse clarification foods');
  }
}

// --- GPT-4: Validate foods (filter out non-foods, emotional states, etc.) ---
async function validateFoods(clarified) {
  const prompt = `
You are a nutrition assistant. For each food entry in the list below, check if it is a real, analyzable food for nutrition analysis. 
- If a food is valid (common foods like eggs, rice, chicken, etc.), include it in the "valid" list.
- Only mark foods as "invalid" if they are clearly misspelled, not real foods, or completely unrecognizable.
- Merge duplicates and synonyms (e.g., 'banana' + 'another banana', 'apple' + 'gala apple').
- Common foods with quantities like "2 eggs", "1 cup rice", "1 chicken breast" should be considered valid.
- Be permissive - if it's a recognizable food, it's valid.

Input: ${JSON.stringify(clarified)}

Respond in this JSON format:
{
  "valid": [ ...valid food objects... ],
  "invalid": [ ...invalid food objects... ],
  "suggestions": [ ...corrections or clarifications for invalid foods, in the same order as 'invalid'... ]
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a nutrition assistant. Be permissive with food validation - accept common foods even without specific measurements. Only reject clearly invalid or misspelled foods."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 700,
    });

    let response = completion.choices[0]?.message?.content?.trim() || "";
    
    // Clean up the response to extract JSON
    if (response.startsWith("```json")) {
      response = response.replace(/```json\s*/, "").replace(/\s*```/, "");
    } else if (response.startsWith("```")) {
      response = response.replace(/```\s*/, "").replace(/\s*```/, "");
    }
    response = response.trim();

    try {
      const parsed = JSON.parse(response);
      return {
        valid: parsed.valid || [],
        invalid: parsed.invalid || [],
        suggestions: parsed.suggestions || [],
      };
    } catch (parseError) {
      console.error('JSON parse error in validateFoods:', parseError, 'Response was:', response);
      // Fallback: assume all foods are valid
      return {
        valid: clarified,
        invalid: [],
        suggestions: [],
      };
    }
  } catch (error) {
    console.error('Error in validateFoods:', error);
    throw new Error('Failed to validate foods');
  }
}

export async function POST(request) {
  try {
    const { message, clarificationContext } = await request.json();
    console.log('🔥 API Request received:', {
      message,
      clarificationContext,
      hasContext: !!clarificationContext,
      hasOriginalClarified: !!(clarificationContext?.originalClarified),
      hasMissing: !!(clarificationContext?.missing)
    });

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    let clarification;
    let allFoods = [];
    let dateKey = null;

    // If this is a clarification response, merge with previous context
    if (clarificationContext && clarificationContext.originalClarified && clarificationContext.missing) {
      console.log('🔍 Processing clarification with context:', {
        originalClarified: clarificationContext.originalClarified,
        missing: clarificationContext.missing,
        userMessage: message
      });

      try {
        // Parse the user's clarification, providing the missing foods for better matching
        const clarifiedFoodsFromUser = await parseClarificationFoods(message, clarificationContext.missing);
        console.log('✅ Parsed clarification foods from user:', clarifiedFoodsFromUser);
        
        // Check if all missing foods have been clarified
        if (!allFoodsClarified(clarificationContext.missing, clarifiedFoodsFromUser)) {
          // Some foods still need clarification
          const stillMissing = clarificationContext.missing.filter(missing =>
            !clarifiedFoodsFromUser.some(clarified => foodNamesMatch(missing, clarified.food || clarified.originalFood || ''))
          );
          
          console.log('⚠️ Still missing foods:', stillMissing);
          
          // Create a new clarification prompt only for the still-missing foods
          const missingPrompts = stillMissing.map(food => {
            const lower = food.toLowerCase();
            if (food.toLowerCase().includes('protein')) {
              return `How much ${food} did you have? For example: 1 scoop, 30g, or 1 bottle.`;
            } else if (food.toLowerCase().includes('oats')) {
              return `How much ${food} did you have? For example: 1 cup, 100g, or 1 packet.`;
            } else if (SERVING_FOODS.some(f => lower.includes(f))) {
              return `How much ${food} did you have? For example: 1 serving, 1 plate, or 1 bowl.`;
            } else {
              return `How much ${food} did you have?`;
            }
          });
          
          return NextResponse.json({
            clarificationNeeded: true,
            clarificationPrompt: missingPrompts.join(' '),
            missing: stillMissing,
            originalClarified: [
              ...(clarificationContext.originalClarified || []),
              ...clarifiedFoodsFromUser
            ],
          });
        }

        // All foods are clarified, merge them
        const baseFoods = clarificationContext.originalClarified || [];
        allFoods = [...baseFoods, ...clarifiedFoodsFromUser];
        console.log('🎉 All foods after merging:', allFoods);
        clarification = { clarified: allFoods, missing: [], clarificationPrompt: null, date: null };
      } catch (parseError) {
        console.error('❌ Error parsing clarification:', parseError);
        return NextResponse.json({
          clarificationNeeded: true,
          clarificationPrompt: "Sorry, I couldn't understand your response. Please try again with specific quantities (e.g., '1 slice', '1 cup', '2 pieces').",
          missing: clarificationContext.missing,
          originalClarified: clarificationContext.originalClarified || []
        });
      }
    } else {
      console.log('🆕 Processing initial food entry (no clarification context)');
      try {
        clarification = await clarifyFoodEntries(message);
        allFoods = clarification.clarified;
        dateKey = clarification.date;
        console.log('📝 Initial clarification result:', clarification);
      } catch (clarifyError) {
        console.error('❌ Error in initial clarification:', clarifyError);
        return NextResponse.json(
          { error: "Could not process your food entry. Please try rephrasing with specific quantities." },
          { status: 400 }
        );
      }
    }

    // If initial clarification is needed
    if (clarification.missing && clarification.missing.length > 0 && clarification.clarificationPrompt) {
      return NextResponse.json({
        clarificationNeeded: true,
        clarificationPrompt: clarification.clarificationPrompt,
        missing: clarification.missing,
        originalClarified: clarification.clarified || [],
      });
    }

    if (!allFoods || allFoods.length === 0) {
      return NextResponse.json(
        { error: "No valid food entries found. Please specify what you ate with quantities." },
        { status: 400 }
      );
    }

    let validation;
    try {
      validation = await validateFoods(allFoods);
      console.log('Validation result:', validation);
    } catch (validateError) {
      console.error('Error validating foods:', validateError);
      return NextResponse.json(
        { error: "Could not validate food entries. Please try again." },
        { status: 500 }
      );
    }

    if (validation.invalid && validation.invalid.length > 0 && (!validation.valid || validation.valid.length === 0)) {
      const suggestions = validation.suggestions && validation.suggestions.length > 0 
        ? validation.suggestions.join(' ') 
        : '';
      return NextResponse.json({
        clarificationNeeded: true,
        clarificationPrompt: `Sorry, I couldn't recognize any valid foods. ${suggestions} Please rephrase with recognizable food names.`,
        missing: validation.invalid.map(item => item.food || item),
      });
    }

    if (!validation.valid || validation.valid.length === 0) {
      return NextResponse.json(
        { error: "No valid food entries found after validation. Please specify recognizable foods." },
        { status: 400 }
      );
    }

    const mergedFoods = mergeDuplicates(validation.valid.map(item => ({
      food: item.food,
      quantity: item.quantity,
      calories: 0,
      mealTime: item.mealTime || '',
    })));

    console.log('Merged foods for Nutritionix:', mergedFoods);

    if (mergedFoods.length === 0) {
      return NextResponse.json(
        { error: "No foods to analyze after merging. Please try again." },
        { status: 400 }
      );
    }

    const nutxQuery = mergedFoods.map(item => `${item.quantity} ${item.food}`).join(' and ');
    console.log('Nutritionix query:', nutxQuery);

    let nutxData = null;
    let breakdown = [];
    let totalCalories = 0;
    try {
      nutxData = await analyzeWithNutritionix(nutxQuery);
      if (nutxData && Array.isArray(nutxData.foods) && nutxData.foods.length > 0) {
        breakdown = nutxData.foods.map((item) => ({
          food: item.food_name,
          quantity: `${item.serving_qty} ${item.serving_unit}`.trim(),
          calories: Math.round(item.nf_calories || 0),
          mealTime: mergedFoods.find(f => foodNamesMatch(f.food, item.food_name))?.mealTime || '',
        }));
        breakdown = mergeDuplicates(breakdown);
        totalCalories = breakdown.reduce((sum, item) => sum + (item.calories || 0), 0);
      } else {
        // Fallback: create breakdown from merged foods with zero calories
        breakdown = mergedFoods.map(item => ({
          food: item.food,
          quantity: item.quantity,
          calories: 0,
          mealTime: item.mealTime || '',
          notes: 'Nutritionix data unavailable'
        }));
      }
    } catch (err) {
      console.error('Nutritionix API error:', err);
      // Fallback: create breakdown from merged foods with zero calories
      breakdown = mergedFoods.map(item => ({
        food: item.food,
        quantity: item.quantity,
        calories: 0,
        mealTime: item.mealTime || '',
        notes: 'Could not fetch calorie data'
      }));
    }

    // Add notes for zero-calorie items
    breakdown.forEach(item => {
      if (item.calories === 0 && !item.notes) {
        item.notes = 'Zero calories or data unavailable';
      }
    });

    if (!dateKey) {
      dateKey = new Date().toISOString().split('T')[0];
    }

    console.log('🎉 Final result:', {
      totalCalories,
      breakdown,
      date: dateKey,
      foodCount: breakdown.length,
      foodNames: breakdown.map(item => item.food)
    });

    return NextResponse.json({
      totalCalories,
      breakdown,
      date: dateKey,
      nutritionix: nutxData,
    });
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
} 