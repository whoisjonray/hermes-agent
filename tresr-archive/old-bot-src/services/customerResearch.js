/**
 * Customer Research Service
 * Implements the deep research methodology from strategy 28
 *
 * The ad's performance is a direct reflection of how deeply you understand your customer.
 * We're looking for CONFESSIONS, not complaints.
 */

// In-memory store (use database in production)
const researchStore = {
  confessions: new Map(),      // category -> [confessions]
  languageBank: new Map(),     // category -> [phrases]
  rootCauses: new Map(),       // category -> [root causes]
  validated: new Map()         // category -> boolean (research complete)
};

// Pre-loaded research from deep dives (these would come from manual research or AI-assisted scraping)
const CATEGORY_RESEARCH = {
  coffee: {
    confessions: [
      {
        content: "I judge people by their coffee order and I'm not sorry",
        source: 'reddit',
        engagement: { upvotes: 2400, comments: 340 },
        emotion: 'pride'
      },
      {
        content: "My personality is 90% coffee and 10% anxiety",
        source: 'twitter',
        engagement: { likes: 15000, retweets: 3200 },
        emotion: 'humor'
      },
      {
        content: "Don't talk to me until I've had my third cup",
        source: 'facebook',
        engagement: { reactions: 890, shares: 120 },
        emotion: 'identity'
      },
      {
        content: "I've spent $6 on coffee every day for 5 years and I'm afraid to do the math",
        source: 'reddit',
        engagement: { upvotes: 5600, comments: 890 },
        emotion: 'confession'
      },
      {
        content: "Coffee isn't a drink, it's a coping mechanism",
        source: 'tiktok',
        engagement: { likes: 45000, comments: 2100 },
        emotion: 'truth'
      },
      {
        content: "I don't have a coffee problem. Coffee has a 'running out' problem.",
        source: 'instagram',
        engagement: { likes: 12000, comments: 450 },
        emotion: 'humor'
      },
      {
        content: "The barista knows my order by heart and it's the most stable relationship I have",
        source: 'twitter',
        engagement: { likes: 8900, retweets: 1200 },
        emotion: 'confession'
      },
      {
        content: "I'm not addicted to coffee. I'm committed to coffee.",
        source: 'reddit',
        engagement: { upvotes: 3400, comments: 210 },
        emotion: 'pride'
      }
    ],
    rootCauses: [
      {
        surface: "Drinks a lot of coffee",
        root: "Coffee is their identity, not just a drink",
        emotional_core: "Want to be part of the coffee culture tribe"
      },
      {
        surface: "Needs coffee to function",
        root: "Coffee is how they cope with adulting",
        emotional_core: "Feel overwhelmed without their ritual"
      },
      {
        surface: "Particular about their coffee",
        root: "Coffee knowledge is a form of sophistication",
        emotional_core: "Want to be seen as discerning, not basic"
      }
    ],
    languageBank: [
      "Third cup? Now we can talk.",
      "Fueled by caffeine and poor decisions",
      "Coffee first, adulting second",
      "I'm not a morning person. I'm a coffee person.",
      "Espresso yourself",
      "But first, coffee.",
      "Coffee is my love language",
      "Decaf? We don't do that here.",
      "I like my coffee like I like my mornings: dark",
      "Coffee: because adulting is hard",
      "This might be wine (it's coffee)",
      "Powered by caffeine and spite",
      "My blood type is coffee",
      "Coffee snob and proud",
      "I take my coffee seriously",
      "Life's too short for bad coffee"
    ]
  },

  fitness: {
    confessions: [
      {
        content: "I go to the gym so I can eat like trash on weekends guilt-free",
        source: 'reddit',
        engagement: { upvotes: 8900, comments: 1200 },
        emotion: 'truth'
      },
      {
        content: "My gym crush is the only reason I show up at 6am",
        source: 'twitter',
        engagement: { likes: 23000, retweets: 4500 },
        emotion: 'confession'
      },
      {
        content: "I've been 'getting back in shape' for 6 years now",
        source: 'reddit',
        engagement: { upvotes: 12000, comments: 2100 },
        emotion: 'humor'
      },
      {
        content: "The mirror flex after a pump is the only validation I need",
        source: 'tiktok',
        engagement: { likes: 67000, comments: 3400 },
        emotion: 'pride'
      },
      {
        content: "Rest day? You mean leg day that I'm avoiding?",
        source: 'instagram',
        engagement: { likes: 15000, comments: 890 },
        emotion: 'confession'
      },
      {
        content: "I don't work out to look good. I work out because I'm fighting demons.",
        source: 'twitter',
        engagement: { likes: 45000, retweets: 8900 },
        emotion: 'truth'
      },
      {
        content: "The gym is my therapy. My therapist is proud.",
        source: 'reddit',
        engagement: { upvotes: 6700, comments: 450 },
        emotion: 'identity'
      },
      {
        content: "I track my macros like it's my job but can't manage my actual job",
        source: 'tiktok',
        engagement: { likes: 34000, comments: 2300 },
        emotion: 'confession'
      }
    ],
    rootCauses: [
      {
        surface: "Goes to the gym regularly",
        root: "Gym is where they feel in control",
        emotional_core: "Life is chaos, but at least I can control my body"
      },
      {
        surface: "Talks about fitness a lot",
        root: "Fitness is their identity and community",
        emotional_core: "Want to belong to a tribe of disciplined people"
      },
      {
        surface: "Obsessed with progress",
        root: "Physical progress is visible proof they're not stuck",
        emotional_core: "Need tangible evidence they're improving at something"
      }
    ],
    languageBank: [
      "Built, not bought",
      "Stronger than yesterday",
      "Eat. Sleep. Lift. Repeat.",
      "The iron doesn't lie",
      "No excuses, just results",
      "Mind over matter",
      "One more rep",
      "Pain is just weakness leaving the body",
      "Earned, not given",
      "Beast mode: activated",
      "I don't sweat, I sparkle",
      "Gym hair, don't care",
      "Deadlifts and chill",
      "Squats and mascara",
      "Will lift for food",
      "Gains over games"
    ]
  },

  gaming: {
    confessions: [
      {
        content: "I've called in sick to work for a game release and I'd do it again",
        source: 'reddit',
        engagement: { upvotes: 15000, comments: 3400 },
        emotion: 'pride'
      },
      {
        content: "My K/D ratio is better than my credit score",
        source: 'twitter',
        engagement: { likes: 34000, retweets: 6700 },
        emotion: 'humor'
      },
      {
        content: "I have 200 unplayed games but I keep buying more",
        source: 'reddit',
        engagement: { upvotes: 23000, comments: 4500 },
        emotion: 'confession'
      },
      {
        content: "'Just one more game' is the biggest lie I tell myself",
        source: 'tiktok',
        engagement: { likes: 89000, comments: 5600 },
        emotion: 'truth'
      },
      {
        content: "My online friends feel more real than my IRL friends",
        source: 'reddit',
        engagement: { upvotes: 8900, comments: 1200 },
        emotion: 'confession'
      },
      {
        content: "I've spent more on skins than on my education",
        source: 'twitter',
        engagement: { likes: 56000, retweets: 12000 },
        emotion: 'confession'
      }
    ],
    rootCauses: [
      {
        surface: "Plays games a lot",
        root: "Games provide achievement in a world where real success feels impossible",
        emotional_core: "Need to feel competent and accomplished at something"
      },
      {
        surface: "Identifies as a gamer",
        root: "Gaming is their social identity and community",
        emotional_core: "Want to belong to a tribe that accepts them"
      },
      {
        surface: "Competitive about games",
        root: "Gaming skill is a status symbol in their world",
        emotional_core: "Want respect and recognition for their dedication"
      }
    ],
    languageBank: [
      "Respawn and retry",
      "GG no re",
      "AFK - Another day, another grind",
      "Touch grass? Never heard of that server",
      "Noob to pro journey",
      "Controller in hand, world on mute",
      "Lag is my nemesis",
      "Sleep is for the weak (and NPCs)",
      "One more game (it's never one)",
      "Press F to pay respects",
      "Main character energy",
      "Rage quit champion",
      "Loading screen philosopher",
      "Camping is a legitimate strategy",
      "Born to game, forced to work"
    ]
  }
};

/**
 * Get research data for a category
 */
export function getCategoryResearch(category) {
  const research = CATEGORY_RESEARCH[category] || CATEGORY_RESEARCH.coffee;
  return {
    confessions: research.confessions,
    rootCauses: research.rootCauses,
    languageBank: research.languageBank,
    isValidated: true
  };
}

/**
 * Get confessions for a category
 */
export function getConfessions(category) {
  return getCategoryResearch(category).confessions;
}

/**
 * Get language bank for a category
 */
export function getLanguageBank(category) {
  return getCategoryResearch(category).languageBank;
}

/**
 * Get root causes for a category
 */
export function getRootCauses(category) {
  return getCategoryResearch(category).rootCauses;
}

/**
 * Get a random confession for ad copy
 */
export function getRandomConfession(category, emotion = null) {
  const confessions = getConfessions(category);
  const filtered = emotion
    ? confessions.filter(c => c.emotion === emotion)
    : confessions;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/**
 * Get random language bank phrases
 */
export function getRandomPhrases(category, count = 3) {
  const phrases = getLanguageBank(category);
  const shuffled = [...phrases].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Generate ad copy using research
 * This creates copy that makes them feel SEEN, not sold to
 */
export function generateAdCopy(category, productTitle) {
  const research = getCategoryResearch(category);
  const confession = getRandomConfession(category);
  const phrases = getRandomPhrases(category, 2);

  // Different hook styles based on research
  const hookStyles = [
    // Confession-based hook
    `"${confession.content}" If this is you, you need this.`,

    // Identity hook
    `For those who get it. No explanation needed.`,

    // Inside joke hook
    `${phrases[0]}. IYKYK.`,

    // Tribe hook
    `This isn't just a shirt. It's a statement.`
  ];

  const hook = hookStyles[Math.floor(Math.random() * hookStyles.length)];

  return {
    hook,
    body: `${productTitle}\n\n${phrases.join(' | ')}\n\nShow your ${category} pride.`,
    cta: 'Shop now →',
    confession_used: confession.content,
    phrases_used: phrases
  };
}

/**
 * Validate if a design text resonates with research
 */
export function validateDesignText(category, text) {
  const languageBank = getLanguageBank(category);
  const confessions = getConfessions(category);

  // Check if text uses language from our bank
  const usesResearchLanguage = languageBank.some(phrase =>
    text.toLowerCase().includes(phrase.toLowerCase().split(' ')[0])
  );

  // Check if text echoes any confessions
  const echosConfession = confessions.some(c =>
    text.toLowerCase().includes(c.content.toLowerCase().split(' ').slice(0, 3).join(' '))
  );

  return {
    valid: usesResearchLanguage || echosConfession,
    usesResearchLanguage,
    echosConfession,
    suggestions: !usesResearchLanguage ? getRandomPhrases(category, 3) : []
  };
}

/**
 * Get design text suggestions based on research
 */
export function getDesignTextSuggestions(category, count = 5) {
  const phrases = getLanguageBank(category);
  const confessions = getConfessions(category);

  const suggestions = [];

  // Add direct language bank phrases
  const shuffledPhrases = [...phrases].sort(() => Math.random() - 0.5);
  suggestions.push(...shuffledPhrases.slice(0, 3));

  // Add confession-derived text
  const confessionTexts = confessions
    .filter(c => c.content.length < 50)
    .map(c => c.content)
    .slice(0, 2);
  suggestions.push(...confessionTexts);

  return suggestions.slice(0, count);
}

/**
 * Score a design concept based on research alignment
 */
export function scoreConceptAlignment(category, conceptText) {
  const research = getCategoryResearch(category);
  let score = 0;

  // Check language bank alignment
  research.languageBank.forEach(phrase => {
    if (conceptText.toLowerCase().includes(phrase.toLowerCase().split(' ')[0])) {
      score += 10;
    }
  });

  // Check root cause alignment
  research.rootCauses.forEach(rc => {
    if (conceptText.toLowerCase().includes(rc.emotional_core.toLowerCase().split(' ')[0])) {
      score += 20;
    }
  });

  // Bonus for using exact confession language
  research.confessions.forEach(c => {
    if (conceptText.toLowerCase().includes(c.content.toLowerCase())) {
      score += 30;
    }
  });

  return {
    score,
    alignment: score > 50 ? 'high' : score > 20 ? 'medium' : 'low',
    recommendation: score < 20
      ? `Consider using phrases like: "${getRandomPhrases(category, 2).join('" or "')}"`
      : 'Good alignment with customer research'
  };
}

/**
 * Research sources for manual deep dives
 */
export const RESEARCH_SOURCES = {
  reddit: (category) => [
    `https://www.reddit.com/r/${category}/top/?t=month`,
    `https://www.reddit.com/search/?q=${category}&sort=top`
  ],
  facebook: (category) => [
    `Search: "${category}" groups`,
    `Look for private groups with 10k+ members`
  ],
  youtube: (category) => [
    `Search: "${category} day in my life"`,
    `Search: "${category} vlog"`,
    `Read comments on viral videos`
  ],
  amazon: (category) => [
    `Search: "${category} t-shirt"`,
    `Read 3-star reviews (most balanced)`,
    `Read 5-star reviews for emotional language`
  ],
  tiktok: (category) => [
    `Search: #${category}`,
    `Look for videos with 100k+ likes`,
    `Read comment sections for confessions`
  ]
};

export default {
  getCategoryResearch,
  getConfessions,
  getLanguageBank,
  getRootCauses,
  getRandomConfession,
  getRandomPhrases,
  generateAdCopy,
  validateDesignText,
  getDesignTextSuggestions,
  scoreConceptAlignment,
  RESEARCH_SOURCES
};
