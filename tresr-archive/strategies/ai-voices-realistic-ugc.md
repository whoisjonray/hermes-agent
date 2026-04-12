# How to Create Realistic AI Voices (That Don't Sound Like Trash)

> Source: t.me/mikoslab

## Why ElevenLabs Isn't the Move

ElevenLabs gets thrown around a lot, but it's **not the best tool for AI UGC, AI ads, or organic content**. The voices just don't sound realistic enough. People can tell it's AI, and that's exactly what you're trying to avoid.

---

## The Two Tools You Actually Need

### Tool #1: MiniMax (For Text-to-Speech)

MiniMax has the **most realistic voices** out of any tool right now. Period.

The text-to-speech model is different - the realism, the cadence—it all feels natural.

**Pricing:**
- Free plan gives you decent credits (might be all you need)
- Paid plan is only **$5/month for 120 minutes**
- Pretty hard to beat

**Why MiniMax is better than ElevenLabs:**

The cadence. The natural flow. When you're doing B-rolls or you need an actor to keep talking, ElevenLabs makes everything sound too polished. Too perfect.

For organic content or AI influencers, you need voices that sound like actual people. Not announcers.

#### How to Use MiniMax

**Option 1: Use Pre-Made Voices**
1. Log in (free account works fine)
2. Go to Text to Speech
3. Pick from their library of voices
4. Generate

**Option 2: Create Your Own Voice**

Two ways to do this:

**Voice Design:**
- Create a custom prompt using Claude or ChatGPT
- Build your own voice from scratch
- Describe exactly what you want

**Voice Clone:**
- Upload a 10-second audio clip
- MiniMax recreates that voice using their tech
- Use it for all your text-to-speech

> **Pro tip:** You can also upload any voice audio and isolate background noise. Great for cleaning up samples before training.

**What MiniMax Voices Sound Like:**

The voice is very realistic. It actually feels like it's in a room talking, not coming through a studio mic with perfect acoustics. When it's too polished, it's not really realistic.

---

### Tool #2: Resemble AI (For Voice Enhancement & Changing)

You might already have an AI video you made. Maybe you used a different tool, or maybe the voice just doesn't sound realistic enough. That's where Resemble AI comes in.

**What makes it special:**

Uses open-source models called **Chatterbox** and **Chatterbox Turbo**. These are significantly better than ElevenLabs' speech-to-speech and voice changer features.

They also have their own text-to-speech model - very realistic and definitely much more realistic than ElevenLabs. Second to MiniMax (MiniMax still has better cadence and quality), but Resemble is a solid option for open-source models.

#### How to Use Resemble AI

**The Voice Changer Feature (Main use case):**

Let's say you already have a video from Veo3, Sora 2, or any other AI video tool. The problem is those static, robotic AI voices don't sound realistic. You can take that voice, extract it, and put it into Resemble AI. It'll change the voice to a more enhanced, realistic version.

**Steps:**
1. Upload your existing AI video audio
2. Pick a target voice from their library that sounds more realistic
3. Generate

The voice gets transformed into something that actually sounds human.

**Creating Custom Voices:**

**Design a Voice:**
- Use a text prompt to describe what you want
- Let the AI generate it

**Clone a Voice (Two methods):**

1. **Rapid Voice Clone** (recommended for most people)
   - Fast model
   - Quality is basically identical to Professional
   - No real difference in testing

2. **Professional Voice Clone**
   - Upload 3-30 minutes of audio
   - Takes about an hour to process
   - Extremely accurate
   - Overkill for most use cases

> **Recommendation:** Stick with Rapid. It's faster and the quality's the same, sometimes even better.

---

## Why ElevenLabs Falls Short

What happens with ElevenLabs:
- Lots of mumbles
- Unclear words ("diffin" instead of "difference")
- Too polished (sounds fake)
- Glitches and distortion

The voice sounds overly processed and people can tell something's off. That's why it doesn't work for AI UGC.

---

## The Complete Workflow

### For New Voiceovers:

1. **Create your script**
2. **Generate voice in MiniMax**
   - Use pre-made voice, OR
   - Clone your own voice, OR
   - Design a custom voice
3. **Use in your UGC videos**

### For Fixing Existing AI Videos:

1. Extract the audio from your existing AI video
2. Upload it to Resemble AI
3. Pick a more realistic target voice or create your own
4. Generate the enhanced version
5. Replace the audio in your video

---

## Why This Matters

When your AI voices sound too polished, people notice. Their guard goes up. They disengage.

But when your voices sound like they're coming from a real person in a real room, that's when the magic happens.

**MiniMax + Resemble AI gives you that realism. ElevenLabs doesn't.**

---

## Tool Links

- **MiniMax:** https://minimax.io/
- **Resemble AI:** https://www.resemble.ai/

---

## Integration Notes for TRESR Bot

**Potential Implementation:**
- Use MiniMax API for generating UGC ad voiceovers
- Use Resemble AI to enhance/fix AI-generated video voices
- Consider for product launch announcement videos
- Could pair with Dynamic Mockups for full ad creative pipeline

**API Considerations:**
- MiniMax: Check API availability and pricing for automation
- Resemble AI: Has API access for voice cloning and enhancement
- Both could integrate into the existing ad creative workflow
