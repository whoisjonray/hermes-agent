# Mockup Research & Generation Workflow

## Overview
This workflow uses Google Image Search to research winning mockup styles, analyzes patterns with Gemini Vision, then generates original improved backgrounds.

## Proven Settings (Coffee Category - v4)

### Design Position on T-Shirt
- **y_offset: 440** (pixels from top of 2048x2048 t-shirt template)
- **design_width: 35%** of t-shirt width
- **centered horizontally**

### T-Shirt Scale on Background
- **scale: 100%** of background size
- **centered** on background

### Background Requirements
- **Square format** (1024x1024)
- **Center 60-70% empty** for t-shirt placement
- **Props at edges/corners only**

## Full Workflow

### Step 1: Research Mockup Patterns
```javascript
import { searchMockups, analyzeMockupPatterns } from './src/services/mockupResearch.js';

// Search Google Images for category mockups
const results = await searchMockups('coffee', 10);
const imageUrls = results.map(r => r.url);

// Analyze patterns with Gemini Vision
const analysis = await analyzeMockupPatterns(imageUrls);
// Returns: backgroundStyles, backgroundColors, framing, props, lighting, overallVibe, geminiPromptToReplicate
```

### Step 2: Generate Lifestyle Background
```javascript
const prompt = `Create a flat-lay product photography background for a t-shirt mockup.

Style: [Based on analysis.overallVibe]
Surface: [Based on analysis.backgroundStyles]
Layout: CENTER MUST BE COMPLETELY EMPTY - all props at edges
Props (arranged around EDGES only):
- Top left: [prop from analysis]
- Top right: [prop from analysis]
- Bottom corners: [props from analysis]

Lighting: ${analysis.lighting}
Color palette: ${analysis.backgroundColors.join(', ')}

IMPORTANT: The center 70% must be clear for product placement.`;

// Generate with Gemini
const response = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
    })
  }
);
```

### Step 3: Composite Mockup (Python PIL)
```python
from PIL import Image

# Load assets
tshirt = Image.open('backgrounds/blank-black-tee-transparent.png').convert('RGBA')
design = Image.open('design.png').convert('RGBA')
background = Image.open('lifestyle-background.png').convert('RGBA')

# Remove black background from design (threshold=35)
data = list(design.getdata())
new_data = []
for item in data:
    if item[0] < 35 and item[1] < 35 and item[2] < 35:
        new_data.append((0, 0, 0, 0))
    else:
        new_data.append(item)
design.putdata(new_data)

# Resize design to 35% of t-shirt width
tshirt_w, tshirt_h = tshirt.size
design_target_width = int(tshirt_w * 0.35)
design_ratio = design_target_width / design.width
design = design.resize((design_target_width, int(design.height * design_ratio)), Image.LANCZOS)

# Position design on t-shirt (y=440 for 2048px template)
design_x = (tshirt_w - design.width) // 2
design_y = 440
tshirt.paste(design, (design_x, design_y), design)

# Scale t-shirt to 100% of background and center
bg_w, bg_h = background.size
scale = min(bg_w / tshirt_w, bg_h / tshirt_h) * 1.00
new_size = (int(tshirt_w * scale), int(tshirt_h * scale))
tshirt_resized = tshirt.resize(new_size, Image.LANCZOS)

pos_x = (bg_w - new_size[0]) // 2
pos_y = (bg_h - new_size[1]) // 2
background.paste(tshirt_resized, (pos_x, pos_y), tshirt_resized)
background.save('final-mockup.png')
```

## Key Files
- `src/services/mockupResearch.js` - Google search + Gemini analysis
- `src/services/designResearch.js` - Hybrid X API + Google for design ideas
- `scripts/mockup_generator.py` - PIL compositor
- `backgrounds/blank-black-tee-transparent.png` - 2048x2048 transparent t-shirt template

## Analysis Results (Coffee Category)
```json
{
  "backgroundStyles": ["Solid color", "Lifestyle scene", "Flat lay"],
  "backgroundColors": ["#FFFFFF", "#222F3E", "#593131", "Wood tones"],
  "framing": "Centered, flat lay with props, or on model",
  "props": ["Coffee mug", "Notebook", "Plants", "Coffee beans"],
  "lighting": "Natural, soft",
  "overallVibe": "Cozy, artisanal, premium coffee culture"
}
```
