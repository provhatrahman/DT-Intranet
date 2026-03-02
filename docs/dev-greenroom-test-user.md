# Greenroom Dev Test User Setup

This document explains how to set up a dummy Greenroom user account for local development testing of Pitch-related features.

## Overview

When developing Pitch app features locally, you can use a shared dummy Greenroom user account instead of creating your own Greenroom account. This allows you to test pitch submission, voting, and other features without needing to manually create a Greenroom account.

## Prerequisites

- Access to the Greenroom backend database or admin interface
- Ability to create a system user in the Greenroom database

## Setup Steps

### 1. Create the Dev User in Greenroom Backend

You need to create a system user in the Greenroom database. The exact method depends on your backend setup:

**Option A: Via Database (if you have direct access)**
```sql
-- Example SQL (adjust table/column names based on your schema)
INSERT INTO system_users (username, display_name, created_at)
VALUES ('dev_pitch_tester', 'Dev Pitch Tester', NOW())
RETURNING id;
```

**Option B: Via Admin Interface**
- Log into the Greenroom admin interface
- Navigate to Users/System Users
- Create a new user with:
  - Username: `dev_pitch_tester` (or similar)
  - Display Name: `Dev Pitch Tester`
- Note the user ID (integer)

**Option C: Via API (if endpoint exists)**
- Check if there's a user creation endpoint in the Greenroom API
- Create the user via API call
- Note the returned user ID

### 2. Configure the Dev User ID

Once you have the user ID, run the setup script:

```bash
bun run scripts/ensure-greenroom-dev-user.ts <user_id>
```

For example, if the user ID is `42`:
```bash
bun run scripts/ensure-greenroom-dev-user.ts 42
```

This script will:
- Verify the Greenroom API is accessible
- Update `.env.local` with the dev user configuration
- Display confirmation and next steps

### 3. Manual Configuration (Alternative)

If you prefer to configure manually, add these to your `.env.local` file:

```env
VITE_DEV_GREENROOM_USER_ID=42
VITE_DEV_GREENROOM_USER_DISPLAY=Dev Pitch Tester
```

Replace `42` with your actual dev user ID.

### 4. Restart Dev Server

After configuring the dev user, restart your development server:

```bash
bun run dev:vercel
```

The environment variables will be picked up on restart.

## Using the Dev Account

### Enable Dev Mode

1. Open the Pitch app in your browser
2. Look for the "Developer Testing" section (only visible in dev builds)
3. Toggle "Use Dev Testing Account" to ON
4. The app will now use the dummy Greenroom user for all API calls

### What Gets Affected

When the dev account is enabled:
- **Pitch Submission**: All new pitches are submitted as the dev user
- **Voting**: Votes are cast as the dev user
- **Comments**: Comments are posted as the dev user
- **Pitch Listing**: "My Pitches" shows pitches submitted by the dev user
- **Incoming Offers**: Offer interactions use the dev user ID

### Disable Dev Mode

Toggle "Use Dev Testing Account" to OFF to return to using your linked Greenroom account (if you have one).

## Troubleshooting

### Dev Toggle Not Appearing

- Ensure you're running in development mode (`bun run dev:vercel`)
- Check that `VITE_DEV_GREENROOM_USER_ID` is set in `.env.local`
- Restart the dev server after adding environment variables

### API Calls Failing

- Verify the user ID exists in the Greenroom database
- Check that the Greenroom API is accessible
- Ensure the user ID is a valid integer

### Wrong User ID Being Used

- Check `.env.local` has the correct `VITE_DEV_GREENROOM_USER_ID`
- Verify the toggle is enabled in the Pitch app UI
- Clear browser localStorage if state seems stale

## Rotating the Dev Account

If the backend database is wiped or you need to use a different dev user:

1. Create a new system user in Greenroom backend
2. Run the setup script again with the new user ID:
   ```bash
   bun run scripts/ensure-greenroom-dev-user.ts <new_user_id>
   ```
3. Restart the dev server

## Security Notes

- The dev account is **only available in development builds** (`import.meta.env.DEV`)
- Production builds will never use the dev account, even if the toggle is enabled
- The dev user ID is stored in `.env.local`, which should be in `.gitignore`
- Never commit `.env.local` with real user IDs to version control

## Related Documentation

- [API Documentation](../API_DOCUMENTATION.md) - Greenroom API endpoints
- [Deployment Guide](../DEPLOYMENT.md) - General deployment information

