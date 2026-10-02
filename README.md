# Flame Score

A MapleStory equipment screenshot analyzer that extracts flame bonus stats with Gemini and calculates a score in JavaScript. The result includes a component-by-component breakdown so players can see how each stat contributes.

## Features

- Upload, drag and drop, or paste an equipment screenshot.
- Preview the image while analysis starts in the background.
- Isolate cyan flame values with pixel-level image processing before sending the screenshot to Gemini.
- Calculate scores with deterministic arithmetic rather than asking the model to perform the math.
- Display primary stat, attack, all-stat percentage, secondary stat, and total contributions.

## Stack

Node.js, Express, JavaScript, Sharp, Multer, Gemini API, HTML, and CSS.

## Run locally

You need Node.js, npm, and a Gemini API key with access to the model configured in `server.js`.

```sh
git clone https://github.com/nathantran07/flame-score-app.git
cd flame-score-app
npm ci
```

Create a `.env` file in the project root:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
```

Replace the placeholder locally, then start the app:

```sh
npm start
```

Open `http://localhost:3000`, add an equipment tooltip screenshot, and click **Calculate** to display the result. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

The server keeps the API key out of browser code. `.env` files, dependencies, logs, and private-key files are excluded by `.gitignore`. Never put a real key in this README or commit it to Git.

## How it works

1. The browser sends the image to `POST /calculate` as multipart form data under the `image` field. The upload limit is 10 MiB, and files are held in memory.
2. Sharp crops the center 70% of the image, converts cyan stat pixels to red and other pixels to grayscale, and resizes the processed image for extraction.
3. Gemini returns stat values as JSON. The server parses them and calculates the score locally.
4. The browser displays the score and its calculation breakdown.

Selecting an image starts the request immediately; clicking Calculate displays the pending result. The processed screenshot is sent to Google's Gemini API.

## Current scoring rules

The primary stat is the highest extracted value among STR, DEX, INT, LUK, and HP. Its corresponding secondary stat is selected from a fixed mapping:

| Primary | Secondary |
|---|---|
| STR | DEX |
| DEX | STR |
| INT | LUK |
| LUK | DEX |
| HP | STR |

```text
score = primary stat + 3 × max(ATT, MATT) + 10 × AllStat + secondary stat / 12
```

The secondary contribution and final total are rounded to two decimal places. These are the app's current rules, not a complete class-specific MapleStory optimizer.

## Limitations

- Extraction depends on tooltip layout, image clarity, and the cyan color threshold. Incorrect extracted values can produce an incorrect score.
- Primary-stat selection is automatic; character selection, configurable scoring profiles, and two-item comparison are not implemented.
- The configured model is `gemini-2.0-flash`. Model access or availability may require updating `server.js`; live API compatibility has not been verified for this publication.
- The app has no automated test suite or authentication/rate limiting. It is intended as a local project rather than a hardened public service.

## Code layout

- `server.js`: upload endpoint, image preprocessing, Gemini extraction, and scoring.
- `public/app.js`: screenshot input, preview, background request, and result display.
- `public/index.html` and `public/style.css`: page structure and styling.

## Basic verification

```sh
node --check server.js
node --check public/app.js
```

These commands check JavaScript syntax. To verify extraction end to end, run the app with a valid key and inspect the result from a known equipment screenshot.
