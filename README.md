# SimilarWeb Proxy — Render.com

Node.js proxy for Traffic Lens that bypasses CloudFront IP blocks.

## Deploy to Render.com

### Step 1: Create a GitHub repo
Push this `render/` folder to a new GitHub repository.

### Step 2: Sign up at Render.com
Go to https://render.com and sign up with GitHub.

### Step 3: Create New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect the GitHub repo you created
3. Render auto-detects `render.yaml` and fills in settings
4. Click **"Create Web Service"**

### Step 4: Get your URL
Render will deploy and give you a URL like:
`https://sw-proxy-trafficlens.onrender.com`

## Usage

```
GET https://sw-proxy-trafficlens.onrender.com/api/sw?domain=github.com
```

Returns raw SimilarWeb JSON data.

## Features

- 12-hour in-memory cache
- CORS headers
- Health check at `/health`
- Handles rate limit gracefully
- ~100ms cached response time
