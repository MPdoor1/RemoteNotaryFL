# 📧 EmailJS Setup Guide - Phase 2

This guide will help you set up EmailJS for sending automated emails from your Remote Notary website.

## 🚀 Quick Setup (5 minutes)

### Step 1: Create EmailJS Account
1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Click "Sign Up" and create a free account
3. Verify your email address

### Step 2: Add Email Service
1. In your EmailJS dashboard, click "Email Services"
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup wizard to connect your email
5. **Copy the Service ID** (e.g., `service_gmail`)

### Step 3: Create Email Templates

#### Template 1: Booking Confirmation
1. Go to "Email Templates" → "Create New Template"
2. Name it: `Booking Confirmation`
3. Copy this template:

```html
Subject: ✅ Notarization Appointment Confirmed - {{booking_id}}

Dear {{client_name}},

Your remote notarization appointment has been successfully scheduled!

📅 APPOINTMENT DETAILS:
• Date: {{appointment_date}}
• Time: {{appointment_time}}
• Document Type: {{document_type}}
• Price: ${{price}}
• Booking ID: {{booking_id}}

📋 WHAT TO PREPARE:
• Valid government-issued photo ID
• Documents to be notarized
• Stable internet connection
• Computer/device with camera and microphone

📱 NEXT STEPS:
1. You'll receive a secure meeting link 24 hours before your appointment
2. A reminder email will be sent 1 hour before your session
3. Payment will be processed after the successful notarization

📞 CONTACT INFO:
Phone: {{phone}}
Special Requests: {{special_requests}}

If you need to reschedule or have questions, please contact us immediately.

Best regards,
Remote Notary Services Team
```

4. **Copy the Template ID** (e.g., `template_booking`)

#### Template 2: Meeting Link
1. Create another template named `Meeting Link`
2. Use this template:

```html
Subject: 🔗 Your Notarization Meeting Link - {{booking_id}}

Dear {{client_name}},

Your notarization appointment is tomorrow! Here's your secure meeting link:

🔗 MEETING LINK: {{meeting_link}}

📅 APPOINTMENT DETAILS:
• Date: {{appointment_date}}
• Time: {{appointment_time}}
• Document Type: {{document_type}}

✅ FINAL CHECKLIST:
□ Valid photo ID ready
□ Documents printed and available
□ Camera and microphone tested
□ Stable internet connection confirmed

⏰ Please join the meeting 5 minutes early.

See you tomorrow!
Remote Notary Services Team
```

#### Template 3: Reminder Email
1. Create template named `Appointment Reminder`
2. Use this template:

```html
Subject: ⏰ Reminder: Notarization in {{hours_until}} hours - {{booking_id}}

Dear {{client_name}},

This is a friendly reminder that your notarization appointment is in {{hours_until}} hours.

📅 APPOINTMENT DETAILS:
• Date: {{appointment_date}}
• Time: {{appointment_time}}
• Document Type: {{document_type}}

🔗 YOUR MEETING LINK: (will be sent separately)

Don't forget to have your ID and documents ready!

Remote Notary Services Team
```

### Step 4: Get Your Public Key
1. Go to "Account" → "General"
2. **Copy your Public Key** (e.g., `abc123xyz`)

### Step 5: Update Your Website Code

Replace these values in `public/script.js`:

```javascript
// Replace these with your actual EmailJS credentials
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY_HERE';
const EMAILJS_SERVICE_ID = 'your_service_id';
const EMAILJS_TEMPLATE_ID = 'template_booking';
```

### Step 6: Enable Email Sending

Uncomment the EmailJS code in the `sendBookingConfirmationEmail` function:

```javascript
// Replace the TODO comment with:
emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, emailData, EMAILJS_PUBLIC_KEY)
    .then(function(response) {
        console.log('Email sent successfully!', response.status, response.text);
    }, function(error) {
        console.error('Failed to send email:', error);
    });
```

## 🧪 Testing Your Setup

1. **Test Admin Panel**: 
   - Visit your website
   - Type `admin` anywhere on the page
   - Admin panel should open

2. **Test Emails**:
   - Enter your email in the test field
   - Click "Send Test Confirmation"
   - Check your inbox (and spam folder)

3. **Test Bookings**:
   - Make a test booking
   - Verify confirmation email is sent

## 📊 EmailJS Free Plan Limits

- ✅ 200 emails/month
- ✅ 2 email services
- ✅ Unlimited templates
- ✅ Basic analytics

Perfect for starting your notary business!

## 🔧 Advanced Features (Optional)

### Auto-Reminders
To send automatic reminder emails, you could:
1. Use GitHub Actions with a scheduled workflow
2. Set up a simple serverless function
3. Use a service like Zapier

### Multiple Templates
Create additional templates for:
- Payment confirmations
- Document delivery
- Follow-up surveys
- Cancellation notices

## 🆘 Troubleshooting

### Emails Not Sending?
1. Check console for errors (F12)
2. Verify all IDs are correct
3. Ensure email service is properly connected
4. Check EmailJS dashboard for failed sends

### Wrong Template Data?
1. Check variable names match exactly
2. Verify template uses `{{variable_name}}` format
3. Test with the admin panel first

## 📞 Support

- EmailJS Documentation: [https://www.emailjs.com/docs/](https://www.emailjs.com/docs/)
- EmailJS Support: support@emailjs.com

---

🎉 **You're ready for Phase 2!** Your booking system now sends professional confirmation emails automatically! 