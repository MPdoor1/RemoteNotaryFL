# 📧 SendGrid API Setup Guide

## Step 1: Get Your SendGrid API Key

1. **Login to SendGrid**
   - Go to [https://app.sendgrid.com/](https://app.sendgrid.com/)
   - Login with your existing account (from DNS setup)

2. **Create API Key**
   - Navigate to Settings → API Keys
   - Click "Create API Key"
   - Choose "Full Access" for permissions
   - Name it: `RemoteNotaryFL-API-Key`
   - **Copy the API key** - you'll need it for Azure

## Step 2: Set Up Environment Variables in Azure

### Option A: Using Azure Portal
1. Go to [portal.azure.com](https://portal.azure.com)
2. Navigate to your App Service: `RemoteNotaryFL`
3. Go to "Configuration" → "Application settings"
4. Click "New application setting" and add these:

```
Name: SENDGRID_API_KEY
Value: [Your SendGrid API Key from Step 1]

Name: SENDGRID_FROM_EMAIL
Value: noreply@yourdomain.com
```

### Option B: Using Azure CLI
```bash
# Set SendGrid API Key
az webapp config appsettings set --resource-group RemoteNotaryFL-rg --name RemoteNotaryFL --settings SENDGRID_API_KEY="your_api_key_here"

# Set From Email Address
az webapp config appsettings set --resource-group RemoteNotaryFL-rg --name RemoteNotaryFL --settings SENDGRID_FROM_EMAIL="noreply@yourdomain.com"
```

## Step 3: Update Your Domain

Replace `yourdomain.com` with your actual domain:
- If your domain is `remotenotaryfl.com`, use `noreply@remotenotaryfl.com`
- If your domain is `enotaryfl.com`, use `noreply@enotaryfl.com`

## Step 4: Deploy Updated Code

Since you have GitHub Actions set up, the deployment will happen automatically when you push to main:

```bash
git add .
git commit -m "Add SendGrid API integration for email notifications"
git push origin main
```

## Step 5: Test Email Functionality

1. **Wait for deployment** (check GitHub Actions tab)
2. **Visit your website** at your custom domain
3. **Make a test booking** to verify emails are sent
4. **Check your email** for the confirmation

## Step 6: Monitor Email Delivery

### SendGrid Dashboard
- Go to SendGrid → Activity → Activity Feed
- Monitor email delivery status
- Check for any failed deliveries

### Azure Logs
- Go to Azure Portal → Your App Service → Logs
- Monitor for any email sending errors

## Email Templates Included

Your website now sends professional HTML emails for:

### 1. Booking Confirmation
- ✅ Appointment details
- 📋 Preparation checklist
- 📱 Next steps information
- 📞 Contact information

### 2. Meeting Link Email
- 🔗 Clickable meeting link
- 📅 Appointment reminder
- ✅ Final preparation checklist
- ⏰ Join timing instructions

## Troubleshooting

### Emails Not Sending?
1. **Check Azure Environment Variables**
   - Ensure `SENDGRID_API_KEY` is set correctly
   - Verify `SENDGRID_FROM_EMAIL` matches your domain

2. **Check SendGrid API Key**
   - Verify the API key has "Full Access" permissions
   - Make sure it's not expired

3. **Domain Authentication**
   - Ensure your DNS records are properly configured
   - Check SendGrid → Settings → Sender Authentication

### Email Going to Spam?
- **Domain Authentication**: Complete sender authentication in SendGrid
- **SPF/DKIM Records**: Ensure DNS records from setup guide are active
- **DMARC Policy**: Verify DMARC record is configured

### Getting 403 Errors?
- **API Key Permissions**: Recreate API key with Full Access
- **Domain Verification**: Complete domain verification in SendGrid
- **Rate Limits**: Check if you've exceeded SendGrid limits

## SendGrid Free Plan Limits

- ✅ **100 emails/day** forever free
- ✅ **Unlimited contacts**
- ✅ **Email API access**
- ✅ **Basic analytics**

Perfect for getting started with your notary business!

## Next Steps

1. **Custom Email Templates**: Modify email HTML in `server.js`
2. **Automated Reminders**: Set up scheduled reminders (future phase)
3. **Email Analytics**: Track open rates and clicks
4. **Advanced Features**: Implement email webhooks for delivery tracking

## Support

- **SendGrid Support**: [https://support.sendgrid.com](https://support.sendgrid.com)
- **Azure Support**: [https://portal.azure.com](https://portal.azure.com) → Support

---

🎉 **Success!** Your notary booking system now sends professional emails automatically! 