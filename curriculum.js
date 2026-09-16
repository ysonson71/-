// English Conversation Curriculum Data
export const CURRICULUM = [
  {
    id: 'cafe',
    title: 'Cafe Order',
    emoji: '☕',
    description: 'Ordering drinks and snacks at a local cafe',
    roleplay: {
      partnerRole: 'Friendly Barista',
      partnerName: 'Emma',
      setting: 'A cozy downtown coffee shop in New York',
      initialMessage: "Hi there! Welcome to Central Brew. What can I get started for you today?",
      userGoal: "Order your favorite coffee and a pastry, and ask for the Wi-Fi password.",
      systemPrompt: "You are Emma, a friendly barista at a cozy New York cafe. You are having a roleplay conversation with an English learner. Keep your responses short (1-2 sentences), upbeat, and conversational. React naturally and ask a relevant question back. Speak 100% in natural English."
    },
    sentences: [
      {
        english: "Could I get an iced Americano with oat milk, please?",
        phonetic: "Could I get an iced Americano with oat milk, please?",
        tip: "Polite and natural way to order any beverage."
      },
      {
        english: "Do you have any dairy-free bakery options today?",
        phonetic: "Do you have any dairy-free bakery options today?",
        tip: "Great for asking about special dietary items or pastries."
      },
      {
        english: "Could you tell me the Wi-Fi password?",
        phonetic: "Could you tell me the Wi-Fi password?",
        tip: "Common everyday request at cafes and public places."
      }
    ]
  },
  {
    id: 'restaurant',
    title: 'Dining Out',
    emoji: '🍽️',
    description: 'Table reservation and ordering food at a restaurant',
    roleplay: {
      partnerRole: 'Restaurant Host / Server',
      partnerName: 'Emma',
      setting: 'A popular Italian bistro on a Friday evening',
      initialMessage: "Good evening! Welcome to Bella Vista. Do you have a reservation with us tonight?",
      userGoal: "Request a table for two, ask for the chef's recommendation, and ask for the check.",
      systemPrompt: "You are Emma, an elegant and welcoming server at an Italian restaurant. The user is a customer practicing English. Keep your replies concise (1-2 sentences), courteous, and natural. Speak 100% in English."
    },
    sentences: [
      {
        english: "We don't have a reservation. Do you have a table for two?",
        phonetic: "We don't have a reservation. Do you have a table for two?",
        tip: "Essential when walking into a busy restaurant."
      },
      {
        english: "What do you recommend from today's special menu?",
        phonetic: "What do you recommend from today's special menu?",
        tip: "Ask server for recommendations like a native speaker."
      },
      {
        english: "Could we have the check, please?",
        phonetic: "Could we have the check, please?",
        tip: "Polite phrase to ask for the bill."
      }
    ]
  },
  {
    id: 'travel',
    title: 'Airport & Travel',
    emoji: '✈️',
    description: 'Checking in and finding your gate at the airport',
    roleplay: {
      partnerRole: 'Airline Gate Agent',
      partnerName: 'Emma',
      setting: 'International departure terminal check-in counter',
      initialMessage: "Hello! Welcome to SkyWay Airlines. Where are you flying to today?",
      userGoal: "Check your bags, ask for a window seat, and verify departure gate info.",
      systemPrompt: "You are Emma, a helpful airport airline agent. The user is a passenger. Answer warmly in 1-2 brief English sentences and guide them through check-in questions."
    },
    sentences: [
      {
        english: "I'd like to check this bag and keep this backpack as carry-on.",
        phonetic: "I'd like to check this bag and keep this backpack as carry-on.",
        tip: "Clear luggage distinction at the check-in desk."
      },
      {
        english: "Is it possible to get a window seat toward the front?",
        phonetic: "Is it possible to get a window seat toward the front?",
        tip: "How to request seating preferences politely."
      },
      {
        english: "Where is gate 24B, and what time does boarding start?",
        phonetic: "Where is gate 24B, and what time does boarding start?",
        tip: "Confirming gate direction and boarding schedule."
      }
    ]
  },
  {
    id: 'smalltalk',
    title: 'Daily Small Talk',
    emoji: '☀️',
    description: 'Casual friendly chat with a friend about weekends and hobbies',
    roleplay: {
      partnerRole: 'College / Work Friend',
      partnerName: 'Emma',
      setting: 'A sunny lounge during lunch break',
      initialMessage: "Hey! Good to see you. How has your week been going so far?",
      userGoal: "Share what you did recently, ask about their weekend plans, and recommend a movie.",
      systemPrompt: "You are Emma, a lively and cheerful friend chatting during break. Reply casually and warmly in 1-2 sentences. Keep the vibe relaxed and fun. Speak 100% in English."
    },
    sentences: [
      {
        english: "I've been pretty busy with work, but things are finally slowing down.",
        phonetic: "I've been pretty busy with work, but things are finally slowing down.",
        tip: "Natural way to describe recent daily life."
      },
      {
        english: "Do you have any fun plans lined up for this weekend?",
        phonetic: "Do you have any fun plans lined up for this weekend?",
        tip: "Classic opening question for friendly small talk."
      },
      {
        english: "I recently watched a fantastic sci-fi movie you might love.",
        phonetic: "I recently watched a fantastic sci-fi movie you might love.",
        tip: "Smooth bridge into sharing recommendations and interests."
      }
    ]
  }
];
