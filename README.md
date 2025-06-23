# AI Health Coach - Calorie Tracking App

An AI-powered health coach that helps users track their daily calorie intake through natural language conversations. Built with React, OpenAI GPT-4, and Nutritionix API.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key
- Nutritionix API credentials

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/J4cobandre/ai_health_coachjs.git
   cd ai_health_coachjs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env.local` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   NUTRITIONIX_APP_ID=your_nutritionix_app_id_here
   NUTRITIONIX_APP_KEY=your_nutritionix_app_key_here
   ```

4. **Run the application**
   ```bash
   npm run dev
   ```

5. **Access the app**
   Open [http://localhost:3000](http://localhost:3000) in your browser

## 🔑 API Keys Setup

### OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an account and generate an API key
3. Add to `.env.local` as `OPENAI_API_KEY`

### Nutritionix API Credentials
1. Visit [Nutritionix Developer](https://developer.nutritionix.com/)
2. Sign up and create an application
3. Get your App ID and App Key
4. Add to `.env.local` as `NUTRITIONIX_APP_ID` and `NUTRITIONIX_APP_KEY`

## 📱 Features

### Core Functionality
- **Natural Language Food Input**: "I had 2 slices of pizza and a soda"
- **Intelligent Calorie Estimation**: Combines GPT-4 analysis with Nutritionix database
- **Smart Clarification System**: Asks for missing quantities with context preservation
- **Real-time Calorie Tracking**: Running daily total displayed prominently
- **Food History Management**: View and edit daily food entries
- **Historical Navigation**: Browse previous days' food intake
- **Offline Storage**: Uses localStorage for data persistence

### Advanced Features
- **Quantity Management**: Inline +/- buttons to adjust food quantities
- **Proper Food Quantification**: "5 chicken breasts" stored as 5 individual entries
- **Intelligent Food Matching**: Handles synonyms and food variations
- **Error Recovery**: Robust error handling with fallback responses
- **Mobile Responsive**: Clean, modern UI that works on all devices

## 🏗️ Architecture

### Frontend (React + Next.js)
- **Components**: Modular, reusable React components
- **State Management**: React hooks for local state
- **Storage**: localStorage for data persistence
- **API Integration**: Fetch API for backend communication

### Backend (Next.js API Routes)
- **Meal Analysis API**: `/api/analyzeMeal` endpoint
- **GPT-4 Integration**: OpenAI API for food clarification and validation
- **Nutritionix Integration**: Real nutrition data lookup
- **Error Handling**: Comprehensive error catching and fallbacks

### Data Flow
1. User inputs food description
2. GPT-4 clarifies and validates food entries
3. Missing quantities trigger clarification requests
4. Nutritionix provides accurate calorie data
5. Food entries stored as individual items in localStorage
6. Real-time UI updates show current totals

## 🛠️ Development Choices

### Why This Tech Stack?
- **React**: Preferred framework as specified in requirements
- **Next.js**: Provides both frontend and API routes in one framework
- **GPT-4**: Superior food understanding and clarification capabilities
- **Nutritionix**: Comprehensive nutrition database with accurate data
- **localStorage**: Simple persistence without database complexity

### Key Implementation Decisions
1. **Individual Entry Storage**: "5 apples" stored as 5 separate entries for granular management
2. **Context Preservation**: Clarification system maintains all previously identified foods
3. **Inline Editing**: Direct quantity adjustment without popup prompts
4. **Fallback Handling**: Graceful degradation when APIs are unavailable
5. **Comprehensive Logging**: Debug output for development and troubleshooting

## 🧪 Testing

### Manual Testing Scenarios
1. **Basic Flow**: "I had breakfast - eggs and toast"
2. **Clarification**: "Pizza and soda" → "How much pizza?" → "2 slices"
3. **Quantity Management**: Add/remove items using +/- buttons
4. **Edge Cases**: Invalid inputs, API failures, empty responses
5. **Persistence**: Refresh browser, navigate dates

### Debug Mode
Enable debug logging by checking browser console for detailed flow information.

## 📦 Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── analyzeMeal/
│   │       └── route.js          # Meal analysis API endpoint
│   │   ├── globals.css               # Global styles
│   │   ├── layout.js                 # App layout component
│   │   └── page.js                   # Main chat interface
│   └── README.md                     # Project documentation
└── public/                       # Static assets
```

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms
- Netlify: Use `npm run build` and deploy `out/` folder
- Docker: Basic Dockerfile included for containerization

## 🎯 Requirements Fulfillment

✅ **LLM Chat Interface**: Natural conversation with AI health coach  
✅ **Calorie Tracking**: Accurate calorie counting with running daily total  
✅ **Food History**: Dedicated panel showing daily food consumption  
✅ **Historical Navigation**: Browse previous days' entries  
✅ **No Login Required**: Immediate access without authentication  
✅ **Modern UI**: Clean, responsive design with excellent UX  
✅ **localStorage**: Data persistence across browser sessions  
✅ **Mobile Friendly**: Responsive design for all devices  

## 💡 Future Enhancements

- User profiles and preferences
- Nutrition macro tracking (protein, carbs, fat)
- Meal planning and suggestions
- Integration with fitness trackers
- Photo-based food recognition
- Social features and sharing

## ⏱️ Development Time

**Estimated Time**: ~7 hours total
- Initial setup and basic functionality: 2 hours
- Advanced features and edge cases: 4 hours  
- Polish, testing, and documentation: 1 hour

## Feedback on the Test Process

This take-home test was well-designed in encouraging realistic product thinking, time management, and the integration of practical tools. I appreciated the clear focus on functionality over aesthetics and the flexibility in technology choices — it allowed me to work with tools I’m familiar with while also making strategic decisions under a time constraint.

That said, to better align the test with real-world development expectations, I’d suggest one small improvement: provide a fixed dataset or API key (even read-only or rate-limited) for calorie/nutrition data. While sourcing and integrating an external nutrition API was a valuable challenge, it took a significant portion of the development time that might otherwise have gone toward optimizing usability or edge case handling.

Including brief example input/output scenarios (e.g., “I had cereal” → should trigger clarification) might also help applicants align their design with your expectations more quickly.
