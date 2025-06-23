# Meal Analysis API - Test Plan for Edge Cases and Robustness

## Overview
This document outlines test cases to verify that the meal analysis API properly handles edge cases and maintains robustness. The main bug fixed was the clarification context not preserving originally clarified foods.

## 🚨 Critical Bug Fix: Clarification Context
**Issue**: When asking for clarification on specific foods, only the clarified foods were processed, ignoring the original foods that were already clear.

**Example**:
- Input: "Had 2 slices of pizza, a soda, and chips"
- System asks: "Could you please specify the quantity of chips?"
- User responds: "1 small bag of chips"
- **OLD BEHAVIOR**: Only processes chips (149 kcal)
- **NEW BEHAVIOR**: Processes pizza + soda + chips (full meal)

## Test Cases

### 1. **Basic Clarification Flow** ✅
```
Input: "Had 2 slices of pizza, a soda, and chips"
Expected: System asks for chips quantity
Response: "1 small bag"
Expected Result: All foods processed (pizza + soda + chips)
```

### 2. **Multiple Missing Foods**
```
Input: "protein shake, oats, banana"
Expected: System asks for protein and oats quantities
Response: "1 scoop protein and 1 cup oatmeal"  
Expected Result: All foods processed with correct quantities
```

### 3. **Partial Clarification**
```
Input: "chicken, rice, vegetables"
Expected: System asks for quantities
Response: "1 chicken breast"
Expected Result: System asks for rice and vegetables quantities, preserves chicken
```

### 4. **Invalid JSON Response Handling**
```
Test: Force GPT to return malformed JSON
Expected: Graceful fallback with helpful error message
```

### 5. **Nutritionix API Failure**
```
Test: Simulate Nutritionix API timeout/error
Expected: Return foods with 0 calories and appropriate notes
```

### 6. **Empty/Invalid Inputs**
```
- Empty message: ""
- Non-food items: "feeling happy, tired"
- Gibberish: "asdfgh qwerty"
Expected: Appropriate error messages or clarification requests
```

### 7. **Food Name Matching Edge Cases**
```
- Synonyms: "protein" vs "protein shake" vs "whey protein"
- Plurals: "banana" vs "bananas"
- Variations: "chicken" vs "chicken breast" vs "chicken thigh"
Expected: Proper matching and merging
```

### 8. **Quantity Parsing Edge Cases**
```
- Decimals: "1.5 cups rice"
- Fractions: "1/2 apple"
- Ranges: "2-3 slices"
- Vague: "some chicken"
Expected: Proper handling or clarification requests
```

### 9. **Date and Time References**
```
- "Had breakfast yesterday"
- "Lunch today"
- "After gym workout"
Expected: Proper date extraction and meal time assignment
```

### 10. **Memory/Context Preservation**
```
Test: Multi-step clarification with complex food list
Expected: All previously clarified foods preserved through each step
```

## Key Improvements Made

### 🔧 **Robustness Enhancements**
1. **JSON Parsing**: Added try-catch blocks with fallback responses
2. **Error Handling**: Comprehensive error catching at each GPT call
3. **Input Validation**: Better validation of empty/invalid inputs
4. **Null Safety**: Added null checks throughout the codebase
5. **Logging**: Added detailed console logs for debugging

### 🔧 **Edge Case Handling**
1. **Food Matching**: Improved `foodNamesMatch()` function
2. **Quantity Merging**: Enhanced `mergeDuplicates()` with decimal support
3. **Clarification Logic**: Fixed `allFoodsClarified()` function
4. **API Fallbacks**: Added fallback responses when APIs fail

### 🔧 **Context Preservation**
1. **Original Foods**: Fixed bug where original clarified foods were lost
2. **State Management**: Improved clarification context handling
3. **Merge Logic**: Enhanced food merging to preserve all data

## Testing Instructions

### Manual Testing
1. Start the development server
2. Test each scenario in the web interface
3. Check browser console for debug logs
4. Verify all foods appear in final breakdown

### Automated Testing (Future)
```javascript
// Example test case
test('preserves original foods during clarification', async () => {
  const response1 = await POST({ message: "2 slices pizza, soda, chips" });
  expect(response1.clarificationNeeded).toBe(true);
  
  const response2 = await POST({ 
    message: "1 small bag", 
    clarificationContext: response1 
  });
  expect(response2.breakdown).toHaveLength(3); // pizza + soda + chips
});
```

## Expected Console Output
When debugging is enabled, you should see logs like:
```
Processing clarification with context: { originalClarified: [...], missing: [...] }
Parsed clarification foods from user: [...]
All foods after merging: [...]
Merged foods for Nutritionix: [...]
Final result: { totalCalories: X, breakdown: [...] }
```

## Success Criteria
- ✅ All originally clarified foods are preserved through clarification steps
- ✅ System gracefully handles API failures
- ✅ Invalid inputs result in helpful error messages
- ✅ Complex food names are properly matched and merged
- ✅ Console logs provide clear debugging information
- ✅ No unhandled exceptions or crashes

## Notes
- The debug console logs should be removed in production
- Consider rate limiting for OpenAI API calls
- Monitor API usage and costs
- Consider caching common food lookups 