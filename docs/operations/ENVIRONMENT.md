# Environment Configuration

## Purpose

This document lists required environment variable names.

Never place actual secret values in this file.

## Client-side Firebase variables

These are used by the Vite frontend:

```VITE_FIREBASE_API_KEY```
```VITE_FIREBASE_AUTH_DOMAIN```
```VITE_FIREBASE_PROJECT_ID```
```VITE_FIREBASE_STORAGE_BUCKET```
```VITE_FIREBASE_MESSAGING_SENDER_ID```
```VITE_FIREBASE_APP_ID```

## Server-side Firebase Admin variables

These are used by API routes and server-side authentication:

```FIREBASE_PROJECT_ID```
```FIREBASE_CLIENT_EMAIL```
```FIREBASE_PRIVATE_KEY```

## Database variables

```DATABASE_URL```

Some local migration commands may use: 

```NEON_DATABASE_URL```

Verify the exact variable used by the repository before changing configuration.

## Rules

- Use development values locally.
- Never commit .env files.
- Never expose production secrets to coding agents.
- Never print secret values in logs, issues, pull requests, or documentation.
- Verify the active environment before running migrations.
