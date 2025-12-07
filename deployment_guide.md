# Deployment Guide - Render.com

This guide will help you deploy your Taboo Card Game to Render.com for free.

## Prerequisites
1.  **GitHub Account**: You need a GitHub account to connect your repository to Render.
2.  **Render Account**: Sign up at [render.com](https://render.com/).

## Steps

### 1. Push Code to GitHub
Ensure your latest code is pushed to your GitHub repository.
```bash
git add .
git commit -m "Prepare for deployment"
git push
```

### 2. Create a New Web Service on Render
1.  Log in to your Render dashboard.
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub account if you haven't already.
4.  Search for your repository (`TabooCardGame`) and click **Connect**.

### 3. Configure the Service
Fill in the following details:

-   **Name**: Choose a name for your app (e.g., `taboo-game`).
-   **Region**: Choose the region closest to you (e.g., Frankfurt, Oregon).
-   **Branch**: `main` (or your default branch).
-   **Root Directory**: Leave empty (defaults to root).
-   **Runtime**: `Node`
-   **Build Command**: `npm run build`
    -   *This command installs dependencies for both client and server, and builds the React client.*
-   **Start Command**: `npm start`
    -   *This command starts the Node.js server.*

### 4. Select Free Plan
-   Scroll down to the **Instance Type** section.
-   Select **Free**.
    -   *Note: The free plan spins down after inactivity, so the first request might take a minute to load.*

### 5. Deploy
-   Click **Create Web Service**.
-   Render will start building your application. You can watch the logs in the dashboard.
-   Once the build finishes and the service is live, you will see a URL (e.g., `https://taboo-game.onrender.com`).

### 6. Play!
-   Share the URL with your friends.
-   They can join directly or use the invite links!
