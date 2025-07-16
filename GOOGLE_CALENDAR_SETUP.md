# Google Calendar API Setup Guide

This guide will help you set up Google Calendar integration for your Remote Notary FL website, so appointments are automatically added to your Google Calendar.

## Step 1: Create Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Name it something like "Remote Notary FL Calendar"

## Step 2: Enable Google Calendar API

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click on it and press **Enable**

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client IDs**
3. If prompted, configure the OAuth consent screen:
   - **Application type**: External
   - **Application name**: Remote Notary FL
   - **User support email**: remotenotaryfl@gmail.com
   - **Authorized domains**: remotenotaryfl.com
   - **Developer contact**: remotenotaryfl@gmail.com
4. For OAuth 2.0 Client ID:
   - **Application type**: Web application
   - **Name**: Remote Notary FL Server
   - **Authorized redirect URIs**: `https://developers.google.com/oauthplayground`
5. Click **Create**
6. **Save the Client ID and Client Secret** - you'll need these!

## Step 4: Generate Refresh Token

1. Go to [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Click the **Settings** (gear icon) in the top right
3. Check **"Use your own OAuth credentials"**
4. Enter your **Client ID** and **Client Secret** from Step 3
5. In the left panel, find **"Calendar API v3"**
6. Select **"https://www.googleapis.com/auth/calendar"**
7. Click **"Authorize APIs"**
8. Sign in with your **remotenotaryfl@gmail.com** account
9. Click **"Allow"** to grant permissions
10. Click **"Exchange authorization code for tokens"**
11. **Save the Refresh Token** - you'll need this!

## Step 5: Add Environment Variables

Add these environment variables to your Azure App Service:

### In Azure Portal:
1. Go to your App Service > **Configuration** > **Application settings**
2. Add these new application settings:

```
GOOGLE_CLIENT_ID=815868300796-hr7mcego674m05i67dbkk27b67fd6icl.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
```

### For Local Development (.env file):
```
GOOGLE_CLIENT_ID=815868300796-hr7mcego674m05i67dbkk27b67fd6icl.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
```

## Step 6: Test the Integration

1. Make a test booking on your website
2. Check your logs for successful calendar event creation
3. Verify the event appears in your Google Calendar

## What Happens Now

When customers book appointments:

✅ **Automatic Calendar Events**: Each booking creates a calendar event in your Google Calendar
✅ **Event Details**: Includes client name, contact info, service type, and booking ID
✅ **Reminders**: Automatic email reminder 1 hour before, popup 15 minutes before
✅ **Client Invitation**: Client receives calendar invitation automatically
✅ **Timezone Handling**: All events are properly set to Eastern Time (Jacksonville, FL)

## Troubleshooting

### Error: "Access blocked"
- Make sure you've configured the OAuth consent screen
- Verify the redirect URI is exactly: `https://developers.google.com/oauthplayground`

### Error: "Invalid grant"
- Your refresh token may have expired
- Regenerate the refresh token using Step 4

### Error: "Insufficient permissions"
- Make sure you selected the correct Calendar API scope
- Re-authorize with the correct permissions

### Calendar events not appearing
- Check the server logs for error messages
- Verify your environment variables are set correctly
- Make sure you're signed in to the correct Google account

## Security Notes

- Keep your Client Secret and Refresh Token secure
- Never commit these credentials to version control
- Consider setting up token rotation for production use
- Monitor your Google Cloud Console for any unusual activity

## Support

If you encounter issues:
1. Check the server logs in Azure App Service
2. Verify all environment variables are correctly set
3. Test the credentials in the OAuth playground
4. Make sure the Google Calendar API is enabled in your project 