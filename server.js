// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');
// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment variables. Payments will fail.');
} else if (!stripeSecretKey.startsWith('sk_')) {
  console.warn('⚠️  STRIPE_SECRET_KEY does not start with "sk_" - this may cause payment processing to fail.');
} else {
  console.log('✅ Stripe API key configured successfully');
}
const stripe = require('stripe')(stripeSecretKey);
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Jacksonville, FL timezone handling
const formatDateTimeForJacksonville = (dateString, timeString) => {
  try {
    // Parse the date and time
    const appointmentDateTime = new Date(`${dateString} ${timeString}`);
    
    // Format for Jacksonville, FL (Eastern Time)
    const options = {
      timeZone: 'America/New_York', // Jacksonville, FL is in Eastern Time
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    const formatted = appointmentDateTime.toLocaleString('en-US', options);
    return formatted + ' ET'; // Add Eastern Time indicator
  } catch (error) {
    console.error('Error formatting date/time:', error);
    return `${dateString} at ${timeString} ET`;
  }
};

const formatDateForJacksonville = (dateString) => {
  try {
    const date = new Date(dateString);
    const options = {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

const formatTimeForJacksonville = (timeString) => {
  try {
    // Parse time string (assumes format like "14:30" or "2:30 PM")
    const today = new Date();
    const [time, period] = timeString.includes('M') ? timeString.split(' ') : [timeString, null];
    const [hours, minutes] = time.split(':').map(Number);
    
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;
    
    const dateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour24, minutes);
    
    const options = {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    return dateTime.toLocaleTimeString('en-US', options) + ' ET';
  } catch (error) {
    console.error('Error formatting time:', error);
    return timeString + ' ET';
  }
};

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SendGrid
const sendGridApiKey = process.env.SENDGRID_API_KEY;
if (!sendGridApiKey) {
  console.warn('⚠️  SENDGRID_API_KEY not found in environment variables. Email notifications will fail.');
} else if (!sendGridApiKey.startsWith('SG.')) {
  console.warn('⚠️  SENDGRID_API_KEY does not start with "SG." - this may cause email sending to fail.');
} else {
  console.log('✅ SendGrid API key configured successfully');
}
sgMail.setApiKey(sendGridApiKey);

// Proof API configuration
const PROOF_API_BASE_URL = 'https://api.proof.com/v1';
const proofApiKey = process.env.PROOF_API_KEY;
if (!proofApiKey) {
  console.warn('⚠️  PROOF_API_KEY not found in environment variables. Proof.com integration will use fallback links.');
} else {
  console.log('✅ Proof API key configured successfully');
}
const PROOF_API_HEADERS = {
  'ApiKey': proofApiKey,
  'Content-Type': 'application/json'
};

// Proof API helper functions
// Function to parse multiple email addresses
const parseEmailAddresses = (emailString) => {
  return emailString
    .split(/[,\n]/)
    .map(email => email.trim())
    .filter(email => email.length > 0);
};

const createProofNotarization = async (bookingData) => {
  try {
    console.log('Creating Proof transaction with API key:', process.env.PROOF_API_KEY ? 'API key present' : 'NO API KEY');
    
    // Split the client name into first and last name
    const nameParts = bookingData.client_name.split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'User';
    
    // Parse multiple email addresses
    const emails = parseEmailAddresses(bookingData.email);
    console.log('Parsed email addresses:', emails);
    
    // Parse the appointment date and time to create ISO date for activation
    // Parse as Jacksonville, FL timezone (Eastern Time)
    const appointmentDateTime = new Date(`${bookingData.appointment_date} ${bookingData.appointment_time}`);
    
    // Convert to Jacksonville timezone for proper handling
    const easternTime = new Date(appointmentDateTime.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const activationTime = easternTime.toISOString();
    
    // Set expiration to 2 hours after appointment time
    const expirationDateTime = new Date(easternTime.getTime() + (2 * 60 * 60 * 1000));
    const expirationTime = expirationDateTime.toISOString();

    // Create signers for each email address
    const signers = emails.map((email, index) => ({
      email: email,
      first_name: index === 0 ? firstName : `${firstName} (${index + 1})`,
      last_name: lastName
    }));

    const transactionData = {
      signers: signers,
      documents: [
        {
          resource: "https://static.notarize.com/Example.pdf",
          requirement: "notarization"
        }
      ],
      transaction_name: `${bookingData.service_name} - ${bookingData.booking_id}`,
      external_id: bookingData.booking_id,
      require_secondary_photo_id: true, // Enhanced ID verification for notarization
      activation_time: activationTime, // When the meeting becomes available
      expiration_time: expirationTime, // When the meeting expires
      suppress_email: false, // Allow Proof to send document upload email to client
      draft: false, // Create as active - client will upload their own documents to replace placeholder
      message_to_signer: `Your live notary appointment is scheduled for ${bookingData.appointment_date} at ${bookingData.appointment_time}. 

IMPORTANT: You must upload your documents before the meeting. Use the link provided to upload the documents you need notarized.

You will meet with a licensed notary via video call. Please have your valid government-issued photo ID ready. The meeting link will become active 15 minutes before your scheduled time.

For technical support, contact remotenotaryfl@gmail.com`,
      message_signature: "Remote Notary FL - Licensed Notary Services"
    };

    console.log('Proof transaction data:', JSON.stringify(transactionData, null, 2));
    console.log('Proof API URL:', `${PROOF_API_BASE_URL}/transactions`);
    console.log('Proof API Headers:', PROOF_API_HEADERS);

    const response = await axios.post(`${PROOF_API_BASE_URL}/transactions`, transactionData, {
      headers: PROOF_API_HEADERS
    });

    console.log('Proof API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating Proof transaction:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
    throw error;
  }
};

const getProofMeetingLink = async (transactionId) => {
  try {
    const response = await axios.get(`${PROOF_API_BASE_URL}/transactions/${transactionId}`, {
      headers: PROOF_API_HEADERS
    });

    // Extract meeting link from transaction data
    const transaction = response.data;
    console.log('Transaction response:', JSON.stringify(transaction, null, 2));
    
    // Check for transaction access link in signer_info
    const meetingLink = transaction.signer_info?.transaction_access_link || 
                       transaction.signing_url || 
                       transaction.notarization_url ||
                       `https://app.proof.com/transaction/${transactionId}`;

    console.log('Extracted meeting link:', meetingLink);
    return meetingLink;
  } catch (error) {
    console.error('Error getting Proof meeting link:', error.response?.data || error.message);
    throw error;
  }
};

// Email templates

const createBusinessNotificationEmail = (bookingData, meetingLink = null) => {
  // Format the appointment date and time for Jacksonville, FL timezone
  const formattedDateTime = formatDateTimeForJacksonville(bookingData.appointment_date, bookingData.appointment_time);
  
  return {
    to: ['remotenotaryfl@remotenotaryfl.com', 'remotenotaryfl@gmail.com'], // Send to both business and personal
    from: 'remotenotaryfl@remotenotaryfl.com',
    subject: `🔔 NEW BOOKING ALERT - ${bookingData.client_name} - ${bookingData.booking_id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #28a745; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="margin: 0;">🎉 NEW BOOKING RECEIVED!</h2>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Someone just scheduled a meeting with you</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 0 0 8px 8px;">
          <h3 style="color: #dc3545; margin-top: 0;">📋 BOOKING DETAILS</h3>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin: 10px 0;"><strong>👤 Client:</strong> ${bookingData.client_name}</li>
              <li style="margin: 10px 0;"><strong>📧 Email:</strong> ${bookingData.email}</li>
              <li style="margin: 10px 0;"><strong>📞 Phone:</strong> ${bookingData.phone || 'Not provided'}</li>
              <li style="margin: 10px 0;"><strong>📅 Date & Time:</strong> ${formattedDateTime}</li>
              <li style="margin: 10px 0;"><strong>💼 Service:</strong> ${bookingData.service_name}</li>
              <li style="margin: 10px 0;"><strong>💰 Amount:</strong> $${bookingData.price} (PAID)</li>
              <li style="margin: 10px 0;"><strong>🆔 Booking ID:</strong> ${bookingData.booking_id}</li>
            </ul>
          </div>
          
          ${bookingData.special_requests ? `
          <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ff9800;">
            <h4 style="color: #f57c00; margin: 0 0 10px 0;">📝 Special Requests:</h4>
            <p style="margin: 0; font-style: italic;">${bookingData.special_requests}</p>
          </div>
          ` : ''}
          
          ${meetingLink ? `
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">
            <h4 style="color: #2e7d32; margin: 0 0 10px 0;">🎥 Meeting Link Ready NOW!</h4>
            <a href="${meetingLink}" style="display: inline-block; background: #4caf50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join Meeting</a>
          </div>
          ` : ''}
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h4 style="color: #1976d2; margin: 0 0 10px 0;">⏰ Next Steps:</h4>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Client will receive their confirmation email automatically</li>
              <li>Meeting link is active NOW and sent to client immediately</li>
              <li>Client will upload documents via Proof.com</li>
              <li>Be ready to join the meeting at scheduled time</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #6c757d; font-size: 14px;">
              Booking confirmed at ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    `
  };
};

const createBookingConfirmationEmail = (bookingData, meetingLink = null, isBusinessCopy = false) => {
  // Format the appointment date and time for Jacksonville, FL timezone
  const formattedDateTime = formatDateTimeForJacksonville(bookingData.appointment_date, bookingData.appointment_time);
  const formattedDate = formatDateForJacksonville(bookingData.appointment_date);
  const formattedTime = formatTimeForJacksonville(bookingData.appointment_time);
  
  const meetingLinkSection = meetingLink ? `
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h3 style="color: #2e7d32; margin-top: 0;">🎥 LIVE NOTARY MEETING LINK - READY NOW!</h3>
          <div style="background: #fff; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #4caf50;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #2e7d32;">✅ Your meeting link is ready and active now!</p>
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">
              <strong>Scheduled for:</strong> ${formattedDateTime}
            </p>
            <a href="${meetingLink}" style="display: inline-block; background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join Live Notary Meeting</a>
          </div>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
            Meeting Link: <code style="background: #f5f5f5; padding: 3px; border-radius: 3px; word-break: break-all;">${meetingLink}</code>
          </p>
        </div>
  ` : '';

  const recipient = isBusinessCopy ? 'remotenotaryfl@remotenotaryfl.com' : bookingData.email;
  const subjectPrefix = isBusinessCopy ? '[BUSINESS COPY] ' : '';

  return {
    to: recipient,
    from: 'remotenotaryfl@remotenotaryfl.com',
    replyTo: 'remotenotaryfl@remotenotaryfl.com',
    subject: `${subjectPrefix}✅ ${bookingData.service_name} Appointment Confirmed - ${bookingData.booking_id}`,
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      'Importance': 'high'
    },
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Appointment Confirmed!</h2>
        
        <p>Dear ${bookingData.client_name},</p>
        
        <p>Your ${bookingData.service_name.toLowerCase()} appointment has been successfully scheduled and paid for!</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #495057; margin-top: 0;">📅 APPOINTMENT DETAILS</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Date & Time:</strong> ${formattedDateTime}</li>
            <li><strong>Service:</strong> ${bookingData.service_name}</li>
            <li><strong>Price:</strong> $${bookingData.price} (PAID)</li>
            <li><strong>Booking ID:</strong> ${bookingData.booking_id}</li>
          </ul>
        </div>
        
        ${meetingLinkSection}
        
        <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
          <h3 style="color: #f57c00; margin-top: 0;">📄 DOCUMENT UPLOAD PROCESS</h3>
          <p><strong>You will receive a separate email from Proof.com with a link to the meeting platform.</strong></p>
          <p><strong>IMPORTANT:</strong> The system may show a "test document" as a placeholder - this is normal. <strong>During your live meeting, you will upload the actual documents you need notarized.</strong></p>
          <p>Simply follow the steps provided in the Proof.com email to access your meeting room when it's time for your appointment.</p>
        </div>
        
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1976d2; margin-top: 0;">📋 LIVE MEETING PREPARATION</h3>
          <ul>
            <li><strong>Valid government-issued photo ID</strong> (driver's license, passport, etc.)</li>
            <li><strong>Secondary photo ID</strong> (required for enhanced verification)</li>
            <li><strong>Original documents</strong> to be notarized (physical copies)</li>
            <li><strong>Stable internet connection</strong> for video quality</li>
            <li><strong>Computer/device with working camera and microphone</strong></li>
            <li><strong>Quiet, well-lit environment</strong> for the video call</li>
            <li><strong>Be prepared to show documents clearly</strong> to the camera</li>
          </ul>
        </div>
        
        <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #7b1fa2; margin-top: 0;">🎥 LIVE NOTARY MEETING DETAILS</h3>
          <ul>
            <li>✅ <strong>Payment of $${bookingData.price} has been processed successfully</strong></li>
            <li>🎥 <strong>This is a LIVE video meeting with a licensed notary</strong></li>
            <li>🔗 ${meetingLink ? 'Your meeting link is ready above and active NOW!' : 'Meeting link will be provided with this confirmation'}</li>
            <li>⏰ <strong>Please join 5 minutes early for technical checks</strong></li>
            <li>🆔 <strong>Have both photo IDs ready to show on camera</strong></li>
            <li>📄 <strong>Original documents must be physically present</strong></li>
            <li>📱 A reminder will be sent 1 hour before your session</li>
          </ul>
        </div>
        
        <div style="margin: 20px 0;">
          <p><strong>📞 CONTACT INFO:</strong></p>
          <p>Phone: ${bookingData.phone}<br>
          Special Requests: ${bookingData.special_requests}</p>
        </div>
        
        <p>If you need to reschedule or have questions, please contact us immediately.</p>
        
        <p>Best regards,<br>
        <strong>Remote Notary Services Team</strong></p>
      </div>
    `
  };
};

const createMeetingLinkEmail = (bookingData, meetingLink) => {
  // Format the appointment date and time for Jacksonville, FL timezone
  const formattedDateTime = formatDateTimeForJacksonville(bookingData.appointment_date, bookingData.appointment_time);
  
  return {
    to: [bookingData.email, 'remotenotaryfl@remotenotaryfl.com', 'remotenotaryfl@gmail.com'], // Send to client and both business emails
    from: 'remotenotaryfl@remotenotaryfl.com',
    subject: `🔗 Your Notarization Meeting Link - ${bookingData.booking_id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Your Meeting Link is Ready!</h2>
        
        <p>Dear ${bookingData.client_name},</p>
        
        <p>Your notarization appointment is coming up! Here's your secure meeting link:</p>
        
        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h3 style="color: #2e7d32; margin-top: 0;">🔗 MEETING LINK</h3>
          <a href="${meetingLink}" style="display: inline-block; background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join Meeting</a>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
            Or copy this link: <br>
            <code style="background: #f5f5f5; padding: 5px; border-radius: 3px;">${meetingLink}</code>
          </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #495057; margin-top: 0;">📅 APPOINTMENT DETAILS</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Date & Time:</strong> ${formattedDateTime}</li>
            <li><strong>Document Type:</strong> ${bookingData.document_type}</li>
          </ul>
        </div>
        
        <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #f57c00; margin-top: 0;">✅ FINAL CHECKLIST</h3>
          <ul>
            <li>✓ Valid photo ID ready</li>
            <li>✓ Documents printed and available</li>
            <li>✓ Camera and microphone tested</li>
            <li>✓ Stable internet connection confirmed</li>
          </ul>
        </div>
        
        <p><strong>⏰ Please join the meeting 5 minutes early.</strong></p>
        
        <p>See you tomorrow!</p>
        
        <p>Best regards,<br>
        <strong>Remote Notary Services Team</strong></p>
      </div>
    `
  };
};

// Email sending endpoints
app.post('/send-booking-confirmation', async (req, res) => {
  try {
    const bookingData = req.body;
    const emailData = createBookingConfirmationEmail(bookingData);
    
    let emailSuccessCount = 0;
    let emailErrors = [];
    
    // Send client confirmation email
    try {
      await sgMail.send(emailData);
      console.log('Client confirmation email sent successfully');
      emailSuccessCount++;
    } catch (clientEmailError) {
      console.error('Failed to send client confirmation email:', clientEmailError.message);
      emailErrors.push(`Failed to send client email: ${clientEmailError.message}`);
    }
    
    // Send business notification email
    try {
      const businessNotificationData = createBusinessNotificationEmail(bookingData);
      await sgMail.send(businessNotificationData);
      console.log('Business notification email sent to remotenotaryfl@remotenotaryfl.com and remotenotaryfl@gmail.com');
      emailSuccessCount++;
    } catch (businessEmailError) {
      console.error('Failed to send business notification email:', businessEmailError.message);
      emailErrors.push(`Failed to send business notification: ${businessEmailError.message}`);
    }
    
    // Return success if at least one email was sent, or partial success message
    if (emailSuccessCount > 0) {
      let message = `${emailSuccessCount} email(s) sent successfully`;
      if (emailErrors.length > 0) {
        message += `, but ${emailErrors.length} email(s) failed`;
      }
      
      res.json({ 
        success: true, 
        message: message,
        email_status: {
          success_count: emailSuccessCount,
          errors: emailErrors
        }
      });
    } else {
      // All emails failed
      res.status(500).json({ 
        success: false, 
        message: 'All emails failed to send',
        email_status: {
          success_count: 0,
          errors: emailErrors
        }
      });
    }
  } catch (error) {
    console.error('Error in booking confirmation endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process booking confirmation',
      error: error.message 
    });
  }
});

app.post('/send-meeting-link', async (req, res) => {
  try {
    const { bookingData, transactionId } = req.body;
    
    // Get the meeting link from Proof API
    let meetingLink = 'https://proof.com/meeting-placeholder'; // Default fallback
    if (transactionId) {
      try {
        meetingLink = await getProofMeetingLink(transactionId);
      } catch (proofError) {
        console.error('Failed to get Proof meeting link:', proofError);
        // Use fallback link if Proof API fails
      }
    }
    
    const emailData = createMeetingLinkEmail(bookingData, meetingLink);
    await sgMail.send(emailData);
    
    res.json({ 
      success: true, 
      message: 'Meeting link email sent successfully',
      meeting_link: meetingLink
    });
  } catch (error) {
    console.error('Error sending meeting link email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send meeting link email',
      error: error.message 
    });
  }
});

// Stripe payment endpoints
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', booking_id, product_id, service_name } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        booking_id: booking_id,
        product_id: product_id,
        service_name: service_name
      }
    });
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
});

app.post('/confirm-payment', async (req, res) => {
  try {
    const { payment_intent_id, booking_data } = req.body;
    
    // Retrieve the payment intent to confirm it was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    
    if (paymentIntent.status === 'succeeded') {
      // Payment successful - create Proof transaction and get meeting link
      let proofTransaction = null;
      let meetingLink = null;
      
      try {
        proofTransaction = await createProofNotarization(booking_data);
        console.log('Proof transaction created:', proofTransaction);
        
        // Get meeting link immediately
        if (proofTransaction && proofTransaction.id) {
          try {
            meetingLink = await getProofMeetingLink(proofTransaction.id);
            console.log('Meeting link obtained:', meetingLink);
          } catch (linkError) {
            console.error('Failed to get meeting link:', linkError);
            // Use fallback link if Proof API fails
            meetingLink = `https://app.proof.com/transaction/${proofTransaction.id}`;
          }
        }
      } catch (proofError) {
        console.error('Failed to create Proof transaction:', proofError);
        console.error('This might be because:');
        console.error('1. Proof API key is invalid or missing');
        console.error('2. Proof account needs to be activated');
        console.error('3. API endpoint or format has changed');
        console.error('4. Account permissions are insufficient');
        
        // Create fallback meeting link
        meetingLink = `https://app.proof.com/booking/${booking_data.booking_id}`;
        console.log('Using fallback meeting link:', meetingLink);
      }
      
      // Parse multiple email addresses and send to all participants
      const emails = parseEmailAddresses(booking_data.email);
      
      // Send booking confirmation with meeting link to all participants
      let emailSuccessCount = 0;
      let emailErrors = [];
      
      for (const email of emails) {
        try {
          const participantBookingData = { ...booking_data, email: email };
          const clientEmailData = createBookingConfirmationEmail(participantBookingData, meetingLink, false);
          await sgMail.send(clientEmailData);
          console.log(`Confirmation email sent to: ${email}`);
          emailSuccessCount++;
        } catch (emailError) {
          console.error(`Failed to send confirmation email to ${email}:`, emailError.message);
          emailErrors.push(`Failed to send email to ${email}: ${emailError.message}`);
        }
      }
      
      // Send business notification email
      try {
        const businessNotificationData = createBusinessNotificationEmail(booking_data, meetingLink);
        await sgMail.send(businessNotificationData);
        console.log('Business notification email sent to remotenotaryfl@remotenotaryfl.com and remotenotaryfl@gmail.com');
      } catch (businessEmailError) {
        console.error('Failed to send business notification email:', businessEmailError.message);
        emailErrors.push(`Failed to send business notification: ${businessEmailError.message}`);
      }
      
      // Create response message based on email success/failure
      let responseMessage = 'Payment confirmed and booking created successfully';
      if (emailSuccessCount > 0) {
        responseMessage += `, ${emailSuccessCount} confirmation email(s) sent`;
      }
      if (emailErrors.length > 0) {
        responseMessage += `, but ${emailErrors.length} email(s) failed to send`;
      }
      
      res.json({
        success: true,
        message: responseMessage,
        payment_intent: paymentIntent,
        proof_transaction: proofTransaction,
        meeting_link: meetingLink,
        email_status: {
          success_count: emailSuccessCount,
          errors: emailErrors
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment was not successful',
        status: paymentIntent.status
      });
    }
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error.message
    });
  }
});

// Document upload completion endpoint - removed automatic test document upload
app.post('/documents-uploaded', async (req, res) => {
  try {
    const { transaction_id, booking_id } = req.body;
    
    // Get updated transaction info after client uploads their documents
    const transactionResponse = await axios.get(`${PROOF_API_BASE_URL}/transactions/${transaction_id}`, {
      headers: PROOF_API_HEADERS
    });
    
    const meetingLink = transactionResponse.data.signer_info?.transaction_access_link || 
                       `https://app.proof.com/transaction/${transaction_id}`;
    
    // Send final confirmation email with meeting link
    const bookingData = req.body.booking_data;
    const clientEmailData = createBookingConfirmationEmail(bookingData, meetingLink, false);
    await sgMail.send(clientEmailData);
    
    res.json({
      success: true,
      message: 'Documents uploaded and transaction ready',
      meeting_link: meetingLink
    });
  } catch (error) {
    console.error('Error processing document upload:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process document upload',
      error: error.message
    });
  }
});



// Proof API endpoints
app.post('/create-notarization', async (req, res) => {
  try {
    const bookingData = req.body;
    const proofTransaction = await createProofNotarization(bookingData);
    
    res.json({
      success: true,
      message: 'Notarization transaction created successfully',
      transaction: proofTransaction
    });
  } catch (error) {
    console.error('Error creating notarization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notarization transaction',
      error: error.message
    });
  }
});

app.get('/get-meeting-link/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const meetingLink = await getProofMeetingLink(transactionId);
    
    res.json({
      success: true,
      meeting_link: meetingLink
    });
  } catch (error) {
    console.error('Error getting meeting link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get meeting link',
      error: error.message
    });
  }
});

// Basic route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint for Azure
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 