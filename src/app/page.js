'use client';

import { useState, useEffect } from 'react';
import Image from "next/image";
import Link from "next/link";

// --- HELPER FUNCTIONS ---
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const getToday = () => {
  return formatDate(new Date());
};

// --- Normalize food name for merging ---
function normalizeFoodName(food) {
  if (!food) return '';
  return food.toLowerCase().replace(/^(a |an |the |some |fresh |raw |cooked |prepared |made )/, '').trim();
}

// --- Merge duplicate foods for a given date ---
function mergeFoodEntries(entries) {
  const merged = {};
  entries.forEach(item => {
    const key = normalizeFoodName(item.food);
    if (!merged[key]) {
      merged[key] = { ...item };
    } else {
      // Merge calories
      merged[key].calories += item.calories;
      // Merge quantities if numeric
      const prevQty = parseFloat(merged[key].quantity);
      const thisQty = parseFloat(item.quantity);
      if (!isNaN(prevQty) && !isNaN(thisQty)) {
        merged[key].quantity = (prevQty + thisQty).toString();
      } else {
        merged[key].quantity = `${merged[key].quantity} + ${item.quantity}`;
      }
    }
  });
  return Object.values(merged);
}

export default function Home() {
  // --- STATE MANAGEMENT ---
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foodHistory, setFoodHistory] = useState({});
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [pendingClarification, setPendingClarification] = useState(null);

  // --- LOCALSTORAGE EFFECT ---
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('foodHistory');
      if (storedHistory) {
        setFoodHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('Failed to parse food history from localStorage:', error);
    }
  }, []);

  // --- DERIVED STATE ---
  const entriesForSelectedDateRaw = foodHistory[selectedDate] || [];
  const entriesForSelectedDate = mergeFoodEntries(entriesForSelectedDateRaw);
  const totalCaloriesForSelectedDate = entriesForSelectedDate.reduce(
    (sum, entry) => sum + entry.calories,
    0
  );
  const totalCaloriesForToday = (foodHistory[getToday()] || []).reduce(
    (sum, entry) => sum + entry.calories,
    0
  );

  // Add this helper function to check if selected date is today
  const isToday = selectedDate === getToday();

  // --- EVENT HANDLERS ---
  const handleDateChange = (daysToAdd) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + daysToAdd);
    setSelectedDate(formatDate(currentDate));
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    let messageToSend = inputValue;
    let contextToSend = null;

    // If we have a pending clarification, prepare the context for the backend
    if (pendingClarification) {
      contextToSend = {
        originalClarified: pendingClarification.originalClarified || [],
        missing: pendingClarification.missing || []
      };
      
      // Don't modify the message - let the backend handle parsing the clarification
      messageToSend = inputValue;
      
      console.log('Sending clarification context:', contextToSend);
    }

    const userMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputValue,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/analyzeMeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: messageToSend,
          clarificationContext: contextToSend
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.clarificationNeeded) {
          setPendingClarification({
            prompt: data.clarificationPrompt,
            originalMessage: messageToSend,
            missing: data.missing || [],
            originalClarified: data.originalClarified || [],
          });
          let suggestionText = data.clarificationPrompt;
          if (data.suggestions && data.suggestions.length > 0) {
            suggestionText += "\n" + data.suggestions.filter(Boolean).join("\n");
          }
          const botMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'bot',
            text: suggestionText,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, botMessage]);
          setIsLoading(false);
          return;
        }

        setPendingClarification(null);

        // Add acknowledgment message with clean food data
        const acknowledgmentMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: `Got it! I'll log that you had ${data.breakdown.map(item => `${item.quantity} ${item.food}`).join(', ')}. Let me estimate the calories based on that...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, acknowledgmentMessage]);

        // Add the calorie results message after a short delay
        setTimeout(() => {
          const resultsMessage = {
            id: (Date.now() + 2).toString(),
            sender: 'bot',
            text: `Total calories: ${data.totalCalories}`,
            calories: data.totalCalories,
            breakdown: data.breakdown,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, resultsMessage]);
        }, 1000);

        if (data.breakdown && data.breakdown.length > 0) {
          const today = getToday();
          const newHistory = { ...foodHistory };
          const todayEntries = newHistory[today] || [];
          
          // Expand quantities into individual entries for proper management
          const expandedEntries = [];
          data.breakdown.forEach(item => {
            console.log('🔍 Frontend: Expanding food item:', item);
            
            // Parse quantity to determine how many individual entries to create
            let quantity = 1; // default
            let individualCalories = item.calories;
            
            // Try to extract numeric quantity from the quantity string
            if (item.quantity && typeof item.quantity === 'string') {
              const qtyMatch = item.quantity.match(/^(\d+(?:\.\d+)?)/);
              if (qtyMatch) {
                quantity = parseFloat(qtyMatch[1]);
                individualCalories = Math.round(item.calories / quantity);
              }
            }
            
            console.log('📊 Frontend: Parsed quantity:', {
              originalQuantity: item.quantity,
              parsedQuantity: quantity,
              totalCalories: item.calories,
              individualCalories: individualCalories
            });
            
            // Create individual entries
            for (let i = 0; i < quantity; i++) {
              expandedEntries.push({
                food: item.food,
                quantity: item.quantity ? item.quantity.replace(/^\d+(\.\d+)?\s*/, '1 ') : '1', // Replace leading number with 1
                calories: individualCalories,
                mealTime: item.mealTime || '',
                notes: item.notes || ''
              });
            }
          });
          
          console.log('✅ Frontend: Expanded entries:', expandedEntries);
          
          newHistory[today] = [...todayEntries, ...expandedEntries];
          setFoodHistory(newHistory);
          localStorage.setItem('foodHistory', JSON.stringify(newHistory));
        }
      } else {
        const errorData = await response.json();
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: errorData.error || "Sorry, I couldn't analyze that meal.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Inline quantity adjustment handlers ---
  const handleIncreaseQuantity = (foodName) => {
    console.log('➕ Frontend: Increasing quantity for:', foodName);
    
    const currentEntries = foodHistory[selectedDate] || [];
    const matchingEntries = currentEntries.filter(entry => 
      normalizeFoodName(entry.food) === normalizeFoodName(foodName)
    );
    
    if (matchingEntries.length === 0) {
      console.warn('⚠️ Frontend: No matching entries found for increase');
      return;
    }
    
    // Use the first matching entry as template and add one more
    const template = matchingEntries[0];
    const newEntry = { ...template };
    
    const newEntries = [...currentEntries, newEntry];
    const newHistory = { ...foodHistory };
    newHistory[selectedDate] = newEntries;
    
    setFoodHistory(newHistory);
    localStorage.setItem('foodHistory', JSON.stringify(newHistory));
    
    console.log('✅ Frontend: Added one more', foodName, 'entry');
  };

  const handleDecreaseQuantity = (foodName) => {
    console.log('➖ Frontend: Decreasing quantity for:', foodName);
    
    const currentEntries = foodHistory[selectedDate] || [];
    const matchingEntries = currentEntries.filter(entry => 
      normalizeFoodName(entry.food) === normalizeFoodName(foodName)
    );
    
    if (matchingEntries.length <= 1) {
      // If only one left, confirm before removing
      if (window.confirm(`Remove the last "${foodName}" entry?`)) {
        handleRemoveFood(foodName, 1);
      }
      return;
    }
    
    // Remove the last matching entry
    let newEntries = [...currentEntries];
    for (let i = newEntries.length - 1; i >= 0; i--) {
      if (normalizeFoodName(newEntries[i].food) === normalizeFoodName(foodName)) {
        console.log('➖ Frontend: Removing entry at index', i);
        newEntries.splice(i, 1);
        break;
      }
    }
    
    const newHistory = { ...foodHistory };
    newHistory[selectedDate] = newEntries;
    
    setFoodHistory(newHistory);
    localStorage.setItem('foodHistory', JSON.stringify(newHistory));
    
    console.log('✅ Frontend: Removed one', foodName, 'entry');
  };

  const handleRemoveAllFood = (foodName) => {
    console.log('🗑️ Frontend: Removing all entries for:', foodName);
    
    if (!window.confirm(`Remove all "${foodName}" entries?`)) {
      return;
    }
    
    const currentEntries = foodHistory[selectedDate] || [];
    const newEntries = currentEntries.filter(entry => 
      normalizeFoodName(entry.food) !== normalizeFoodName(foodName)
    );
    
    const newHistory = { ...foodHistory };
    if (newEntries.length === 0) {
      delete newHistory[selectedDate];
    } else {
      newHistory[selectedDate] = newEntries;
    }
    
    setFoodHistory(newHistory);
    localStorage.setItem('foodHistory', JSON.stringify(newHistory));
    
    console.log('✅ Frontend: Removed all', foodName, 'entries');
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Panel */}
          <div className="lg:col-span-2">
            <div className="card flex flex-col h-[75vh] overflow-hidden">
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">AI Health Coach</h2>
                <p className="text-sm text-gray-600">Track your meals and calories effortlessly</p>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <div className="mb-4">
                      <Image src="/globe.svg" alt="Welcome" width={64} height={64} className="opacity-50" />
                    </div>
                    <p className="text-lg font-medium mb-2">Welcome to your AI Health Coach!</p>
                    <p className="text-sm">Tell me what you ate, and I'll help you track your calories.</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                      <div className={message.sender === 'bot' ? 'message message-bot' : 'message message-user'}>
                        {message.text}
                        {message.breakdown && (
                          <div className="mt-2 text-sm">
                            {message.breakdown.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center">
                                <span>{item.food}</span>
                                <span className="ml-4 font-medium">{item.calories} kcal</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-gray-200">
                <div className="flex gap-4">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="What did you eat?"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    disabled={isLoading}
                  />
                  <button 
                    type="submit" 
                    className={`button-primary whitespace-nowrap ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Analyzing...' : 'Track Meal'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Summary Panel */}
          <div className="h-[75vh] flex flex-col gap-4">
            {/* Today's Summary Card */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">
                {isToday ? "Today's Summary" : "Daily Summary"}
              </h3>
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-gray-900">{totalCaloriesForSelectedDate}</span>
                  <span className="text-gray-600">calories</span>
                </div>
              </div>
              
              {/* Date Navigation */}
              <div className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg p-2">
                <button
                  className={`px-3 py-1.5 rounded-full font-medium text-xs transition shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-300
                    bg-white text-gray-700 hover:bg-pink-100 hover:text-pink-700
                  `}
                  onClick={() => handleDateChange(-1)}
                  type="button"
                >
                  Previous Day
                </button>
                <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{selectedDate}</div>
                <button
                  className={`px-3 py-1.5 rounded-full font-medium text-xs transition shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-300
                    ${isToday ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-pink-100 hover:text-pink-700'}
                  `}
                  onClick={() => !isToday && handleDateChange(1)}
                  disabled={isToday}
                  type="button"
                >
                  Next Day
                </button>
              </div>
            </div>

            {/* Food History Card */}
            <div className="card flex-1 flex flex-col min-h-0">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Food History</h3>
                <button
                  className="ml-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 hover:bg-pink-100 hover:text-pink-700 transition"
                  onClick={() => {
                    if (window.confirm('Clear all food entries for this date?')) {
                      console.log('🗑️ Frontend: Clearing all entries for date:', selectedDate);
                      setFoodHistory(prev => {
                        const newHistory = { ...prev };
                        delete newHistory[selectedDate];
                        localStorage.setItem('foodHistory', JSON.stringify(newHistory));
                        console.log('💾 Frontend: Cleared all entries, updated localStorage');
                        return newHistory;
                      });
                    }
                  }}
                  type="button"
                  title="Clear all food entries for this date"
                >
                  Clear All
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="divide-y divide-gray-100">
                  {entriesForSelectedDate.length === 0 ? (
                    <div className="p-6">
                      <p className="text-sm text-gray-500">No entries for this date.</p>
                    </div>
                  ) : (
                    entriesForSelectedDate.map((entry, idx) => {
                      // Count how many raw entries match this merged entry
                      const rawEntries = foodHistory[selectedDate] || [];
                      const matchingRawCount = rawEntries.filter(rawEntry => 
                        normalizeFoodName(rawEntry.food) === normalizeFoodName(entry.food)
                      ).length;
                      
                      console.log('🔍 Frontend: Rendering entry:', {
                        food: entry.food,
                        calories: entry.calories,
                        matchingRawCount,
                        quantity: entry.quantity
                      });

                      return (
                        <div key={idx} className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="font-medium text-gray-900">{entry.food}</span>
                                                         <span className="text-gray-500">
                               {entry.quantity && entry.quantity.replace(/^\d+(\.\d+)?\s*/, '').trim() && `(${entry.quantity.replace(/^\d+(\.\d+)?\s*/, '')})`}
                             </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {/* Inline quantity adjustment buttons */}
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{entry.calories} kcal</span>
                              
                              <div className="flex items-center gap-1 ml-2">
                                {/* Decrease quantity button */}
                                <button
                                  onClick={() => {
                                    console.log('➖ Frontend: Decrease quantity clicked for:', entry.food);
                                    handleDecreaseQuantity(entry.food);
                                  }}
                                  className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                  title="Remove one"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                  </svg>
                                </button>
                                
                                {/* Quantity display */}
                                <span className="px-2 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded min-w-[2rem] text-center">
                                  {matchingRawCount}
                                </span>
                                
                                {/* Increase quantity button */}
                                <button
                                  onClick={() => {
                                    console.log('➕ Frontend: Increase quantity clicked for:', entry.food);
                                    handleIncreaseQuantity(entry.food);
                                  }}
                                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Add one more"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                </button>
                                
                                {/* Remove all button (only show for multiple items) */}
                                {matchingRawCount > 1 && (
                                  <button
                                    onClick={() => {
                                      console.log('🗑️ Frontend: Remove all clicked for:', entry.food);
                                      handleRemoveAllFood(entry.food);
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-1"
                                    title="Remove all"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
