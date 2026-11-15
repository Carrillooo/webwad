# START: build your first site

No coding and no terminal needed. You talk, the agent builds.

## What you need
- **Claude Code** (recommended) or **Codex**, on a paid plan (from about $20 a month).
  - Claude Code: install the Claude app from claude.com/download and sign in.
  - Codex: comes with a paid ChatGPT plan.
- That is all. The agent installs every other tool it needs by itself.
- Optional: an image or video generator, if you want AI-made photos and video. The agent tells you
  when one would help and writes the prompts for you.

## 1. Prepare the folder (1 minute)
1. Unzip the kit.
2. Rename the folder after your project, for example `coffee-shop-site`.
3. Keep all your projects inside one parent folder, for example `Sites/`.

**Every new site = a fresh copy of the kit folder.** Never build two sites in one folder.

## 2. Open the folder in the agent
- **Claude app:** open the Code tab, choose "Select folder" and pick your project folder.
- **Terminal users:** open the folder in a terminal and run `claude` (or `codex`).

Pick the strongest model with the highest effort for the first build. For small edits later a lower
setting is fine and cheaper.

## 3. Send the first message
```
Hi, let's build a website.
```
On the first run the agent checks your computer and installs what is missing. It may ask you to
allow a command: say yes. This takes a few minutes, once.

Then it offers four paths:
- **A** Just show me something impressive (no idea needed)
- **B** A site for my business or a client
- **C** I already have an idea or references
- **D** Rebuild a ready recipe

Not sure? Pick **A** for your first site. It is the fastest way to see what the kit can do.

## 4. What happens next
1. **Idea.** The agent proposes concepts. You pick one.
2. **References.** It studies real award-level sites that fit your idea.
3. **Summary.** You get five lines: mood, colours, fonts, the main effect. You say "yes" or ask for changes.
4. **Hero media.** The agent tells you exactly which image, video or 3D model the first screen
   needs, where to make it and with which prompt. You drop the file into the folder it names.
5. **Build.** It builds the site section by section and opens a preview for you.
6. **Self-check.** It screenshots its own work and fixes what is off.
7. **Rest of the media, edits, going live.** It helps you put the site online on free hosting.

Plan a few hours for your first site. The next ones go faster.

## 5. How to ask for changes
Write the way you would tell a designer:
- "The headline is too big on the phone."
- "Make the first screen calmer."
- "I don't like the colours, show me two other options."

One request per message works best. For typical problems ("looks dead", "the 3D model is dark",
"it lags") there are ready phrases in `system/08-fix-prompts.md`.

## 6. References (optional, they help a lot)
- Links to sites you like: paste them into `refs/sites.txt`, one per line.
- Screenshots or Pinterest images: put them into `refs/images/`.

No references? The agent picks them for your idea itself.

## If something goes wrong
- **The agent stopped or seems lost.** Write: "Read brief.md and continue from where you stopped."
- **An install step failed.** Copy the error text into the chat and write "fix this". If it asks you
  to run one command yourself, copy it exactly as given.
- **The preview does not open.** Write: "Start the local server and give me the link."
- **You hit your plan's usage limit.** Wait for the reset shown in the app, then write "continue".
  Your progress is saved in `brief.md`.
- **You want to start over.** Make a fresh copy of the kit folder. Do not reuse the old one.
- **Still stuck?** Write to hello@madebyeveren.com and describe what happened. Screenshots help.

## Credits
Prompt-syntax library for image and video models (`vendor/visual-skills/`): Serge Shima,
github.com/smixs/visual-skills, licensed CC BY 4.0 (Russian passages translated to English).
