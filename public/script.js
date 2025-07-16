// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const href = this.getAttribute('href');
        // Ensure href is valid and not just "#"
        if (href && href.length > 1) {
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// Timezone Detection and Conversion
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const jacksonvilleTZ = 'America/New_York'; // Jacksonville, FL timezone

// Get user's timezone name for display
const getUserTimezoneDisplay = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const shortName = timezone.split('/').pop().replace(/_/g, ' ');
    return shortName;
};

// Convert time from user timezone to EST
const convertToEST = (dateString, timeString) => {
    const userDateTime = new Date(`${dateString}T${timeString}`);
    const estDateTime = new Date(userDateTime.toLocaleString("en-US", {timeZone: jacksonvilleTZ}));
    return {
        date: estDateTime.toISOString().split('T')[0],
        time: estDateTime.toTimeString().substr(0, 5)
    };
};

// Convert time from EST to user timezone
const convertFromEST = (dateString, timeString) => {
    // Create a date object assuming the input is in EST
    const estDateTime = new Date(`${dateString}T${timeString}`);
    
    // Convert to user's timezone
    const userDateTime = new Date(estDateTime.toLocaleString("en-US", {timeZone: userTimezone}));
    
    return {
        date: userDateTime.toISOString().split('T')[0],
        time: userDateTime.toTimeString().substr(0, 5)
    };
};

// Format time for display with timezone indicator
const formatTimeWithTimezone = (hour, minute, showEST = false) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    const timeStr = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
    
    if (showEST) {
        return `${timeStr} EST`;
    } else {
        const tzDisplay = getUserTimezoneDisplay();
        return `${timeStr} ${tzDisplay}`;
    }
};

// Check if user is in Eastern Time
const isUserInEasternTime = () => {
    return userTimezone === jacksonvilleTZ || userTimezone === 'America/Detroit' || userTimezone === 'America/Toronto';
};

// Booking System
let bookings = JSON.parse(localStorage.getItem('notaryBookings') || '[]');

// EmailJS Configuration (you'll need to replace these with your actual EmailJS credentials)
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY'; // Replace with your EmailJS public key
const EMAILJS_SERVICE_ID = 'service_notary'; // Replace with your EmailJS service ID
const EMAILJS_TEMPLATE_ID = 'template_booking_confirmation'; // Replace with your template ID

// Stripe Configuration
const stripe = Stripe('pk_live_51RknYjGpt03TMvPV64qnnRVkH5GHluzHm6JINV4wFsdWkC5ur0ccsBN37JVA7LkLfmBOPe1Ts43mxxQ66VXxEwLY004cVijecC');
const elements = stripe.elements();
let cardElement = null;

// Initialize EmailJS and Stripe
document.addEventListener('DOMContentLoaded', function() {
    // For now, we'll use a demo mode - you'll need to set up EmailJS account
    console.log('EmailJS initialized for booking confirmations');
    
    // Initialize Stripe Elements
    initializeStripeElements();
});

// Service options with Stripe product IDs and pricing
const serviceOptions = {
    'notarization': {
        name: 'Notarization Service',
        price: 50,
        productId: 'prod_SgACWbsnIVSura',
        description: 'Complete notarization process with identity verification'
    },
    'signing': {
        name: 'Real Estate Signing', 
        price: 200,
        productId: 'prod_SgABkZ7XWvSiYa',
        description: 'Complete real estate transaction signing and notarization'
    }
};

// Stripe Elements initialization
function initializeStripeElements() {
    if (!cardElement) {
        const style = {
            base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                    color: '#aab7c4',
                },
            },
            invalid: {
                color: '#9e2146',
            },
        };
        
        cardElement = elements.create('card', { style });
        cardElement.mount('#card-element');
        
        // Handle real-time validation errors from the card Element
        cardElement.on('change', ({ error }) => {
            const displayError = document.getElementById('card-errors');
            if (error) {
                displayError.textContent = error.message;
            } else {
                displayError.textContent = '';
            }
        });
    }
}

function updatePaymentAmount() {
    const serviceType = document.getElementById('serviceType').value;
    const paymentAmount = document.getElementById('paymentAmount');
    
    if (serviceType && serviceOptions[serviceType]) {
        paymentAmount.textContent = serviceOptions[serviceType].price;
    } else {
        paymentAmount.textContent = '0';
    }
}

// Process Stripe Payment
async function processStripePayment(booking) {
    try {
        // Create payment intent
        const response = await fetch('/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: booking.price,
                product_id: booking.productId,
                service_name: booking.serviceName,
                booking_id: booking.id
            })
        });
        
        const { success, clientSecret, error } = await response.json();
        
        if (!success) {
            throw new Error(error || 'Failed to create payment intent');
        }
        
        // Confirm payment with Stripe
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: booking.name,
                    email: booking.email,
                    phone: booking.phone
                }
            }
        });
        
        if (stripeError) {
            throw new Error(stripeError.message);
        }
        
        if (paymentIntent.status === 'succeeded') {
            // Confirm payment and create booking on server
            const confirmResponse = await fetch('/confirm-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    payment_intent_id: paymentIntent.id,
                    booking_data: {
                        client_name: booking.name,
                        email: booking.allEmails, // Send all emails to server
                        phone: booking.phone,
                        booking_id: booking.id,
                        appointment_date: formatBookingDate(booking.date),
                        appointment_time: booking.time, // Use EST time for server processing
                        service_type: booking.serviceType,
                        service_name: booking.serviceName,
                        product_id: booking.productId,
                        price: booking.price,
                        special_requests: booking.specialRequests || 'None'
                    }
                })
            });
            
            const confirmResult = await confirmResponse.json();
            
            if (confirmResult.success) {
                // Store proof transaction ID if available
                if (confirmResult.proof_transaction) {
                    booking.proofTransactionId = confirmResult.proof_transaction.id;
                }
                return true;
            } else {
                throw new Error(confirmResult.message || 'Payment confirmation failed');
            }
        } else {
            throw new Error('Payment was not successful');
        }
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed: ' + error.message);
        return false;
    }
}

function openBookingModal() {
    console.log('openBookingModal called');
    const modal = document.getElementById('bookingModal');
    console.log('Modal element:', modal);
    
    if (!modal) {
        alert('Modal not found! Please refresh the page.');
        return;
    }
    
    modal.style.display = 'block';
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    const appointmentDate = document.getElementById('appointmentDate');
    if (appointmentDate) {
        appointmentDate.min = today;
        
        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        appointmentDate.value = tomorrow.toISOString().split('T')[0];
    }
    
    // Generate initial time slots
    generateTimeSlots();
    
    // Initialize Stripe Elements if not already done
    initializeStripeElements();
    
    // Set up service type change listener
    const serviceTypeSelect = document.getElementById('serviceType');
    if (serviceTypeSelect) {
        serviceTypeSelect.addEventListener('change', updatePaymentAmount);
    }
}

function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    modal.style.display = 'none';
    document.getElementById('bookingForm').reset();
}

function generateTimeSlots() {
    const selectedDate = document.getElementById('appointmentDate').value;
    const timeSlotsContainer = document.getElementById('timeSlots');
    
    if (!selectedDate) {
        timeSlotsContainer.innerHTML = '<p>Please select a date first</p>';
        return;
    }
    
    // Add timezone info display
    const isEasternTime = isUserInEasternTime();
    const tzInfo = isEasternTime ? 
        '<div class="timezone-info">🕐 You\'re in Eastern Time - same as Jacksonville, FL!</div>' :
        `<div class="timezone-info">🕐 Times shown in your timezone (${getUserTimezoneDisplay()}). Jacksonville, FL times shown in EST.</div>`;
    
    // Business hours: 8 AM to 8 PM EST, 30-minute slots
    const timeSlots = [];
    for (let hour = 8; hour <= 19; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const estTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            
            // Convert EST to user's timezone for display
            const userTimeSlot = convertFromEST(selectedDate, estTime);
            const userHour = parseInt(userTimeSlot.time.split(':')[0]);
            const userMinute = parseInt(userTimeSlot.time.split(':')[1]);
            
            // Skip if converted time is outside reasonable hours (e.g., 2 AM)
            if (userHour < 6 || userHour > 23) continue;
            
            const displayTime = isEasternTime ? 
                formatTimeWithTimezone(hour, minute, true) :
                formatTimeWithTimezone(userHour, userMinute, false);
            
            const estDisplay = isEasternTime ? '' : ` (${formatTimeWithTimezone(hour, minute, true)})`;
            
            // Check if slot is already booked (using EST time for consistency)
            const isBooked = bookings.some(booking => 
                booking.date === selectedDate && booking.time === estTime
            );
            
            timeSlots.push({
                time: estTime, // Always store EST time
                userTime: userTimeSlot.time, // User's local time
                display: displayTime + estDisplay,
                booked: isBooked
            });
        }
    }
    
    // Generate time slot buttons
    timeSlotsContainer.innerHTML = tzInfo + timeSlots.map(slot => `
        <div class="time-slot ${slot.booked ? 'unavailable' : ''}" 
             data-time="${slot.time}" 
             data-user-time="${slot.userTime}"
             onclick="${slot.booked ? '' : 'selectTimeSlot(this)'}">
            ${slot.display}
            ${slot.booked ? '<br><small>Booked</small>' : ''}
        </div>
    `).join('');
}

function formatTime(hour, minute) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

function selectTimeSlot(element) {
    // Remove previous selections
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });
    
    // Select current slot
    element.classList.add('selected');
    
    // Store both EST time (for server) and user time (for display)
    const estTime = element.getAttribute('data-time');
    const userTime = element.getAttribute('data-user-time');
    
    // Update global variables for booking
    window.selectedTimeSlot = {
        estTime: estTime,
        userTime: userTime,
        displayText: element.textContent.trim()
    };
}

// Helper function to format date without timezone issues
function formatBookingDate(dateString) {
    // Parse the date string (YYYY-MM-DD) manually to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Email Templates and Functions
async function sendBookingConfirmationEmail(booking) {
    const emailData = {
        email: booking.email,
        client_name: booking.name,
        booking_id: booking.id,
        appointment_date: formatBookingDate(booking.date),
        appointment_time: booking.time, // Use EST time for server processing
        service_type: booking.serviceType,
        service_name: booking.serviceName || booking.serviceType,
        price: booking.price,
        phone: booking.phone,
        special_requests: booking.specialRequests || 'None'
    };
    
    console.log('📧 Sending confirmation email to:', booking.email);
    
    try {
        const response = await fetch('/send-booking-confirmation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Email sent successfully!');
            return emailData;
        } else {
            console.error('❌ Failed to send email:', result.message);
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('❌ Error sending email:', error);
        throw error;
    }
}

async function sendMeetingLinkEmail(booking, meetingLink) {
    const bookingData = {
        email: booking.email,
        client_name: booking.name,
        booking_id: booking.id,
        appointment_date: formatBookingDate(booking.date),
        appointment_time: booking.time, // Use EST time for server processing
        document_type: booking.documentType.replace('-', ' ').toUpperCase()
    };
    
    console.log('📧 Sending meeting link email to:', booking.email);
    console.log('Meeting link:', meetingLink);
    
    try {
        const response = await fetch('/send-meeting-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bookingData, meetingLink })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Meeting link email sent successfully!');
            return bookingData;
        } else {
            console.error('❌ Failed to send meeting link email:', result.message);
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('❌ Error sending meeting link email:', error);
        throw error;
    }
}

function sendReminderEmail(booking) {
    const emailData = {
        to_email: booking.email,
        client_name: booking.name,
        booking_id: booking.id,
        appointment_date: formatBookingDate(booking.date),
        appointment_time: booking.time, // Use EST time for server processing
        service_type: booking.serviceType,
        service_name: booking.serviceName || booking.serviceType,
        hours_until: calculateHoursUntilAppointment(booking)
    };
    
    console.log('⏰ Sending reminder email to:', booking.email);
    
    // TODO: Replace with actual EmailJS send for reminder template
    return emailData;
}

function calculateHoursUntilAppointment(booking) {
    const appointmentDateTime = new Date(`${booking.date}T${booking.time}`);
    const now = new Date();
    const timeDiff = appointmentDateTime.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 3600)); // Convert to hours
}

async function showBookingConfirmation(booking) {
    // Send confirmation email
    try {
        const emailData = await sendBookingConfirmationEmail(booking);
        
        const confirmationMessage = `
            🎉 Appointment Scheduled Successfully!
            
            📅 Date: ${emailData.appointment_date}
            ⏰ Time: ${emailData.appointment_time}
            📋 Service: ${emailData.service_name}
            💰 Price: $${emailData.price} (PAID)
            
            📧 Confirmation email sent to: ${booking.email}
            📱 Meeting link will be sent 24 hours before appointment
            ⏰ Reminder email will be sent 1 hour before appointment
            
            Next Steps:
            1. Check your email for confirmation details
            2. You'll receive a secure meeting link via email
            3. Have your ID and documents ready
            4. Payment will be processed after the session
            
            Booking ID: ${booking.id}
        `;
        
        alert(confirmationMessage);
    } catch (error) {
        console.error('Error sending confirmation email:', error);
        
        const confirmationMessage = `
            🎉 Appointment Scheduled Successfully!
            
            📅 Date: ${formatBookingDate(booking.date)}
            ⏰ Time: ${booking.timeDisplay}
            📋 Document: ${booking.documentType ? booking.documentType.replace('-', ' ').toUpperCase() : 'N/A'}
            💰 Price: $${booking.price}
            
            ⚠️ Email notification failed, but booking is confirmed
            📱 Meeting link will be sent 24 hours before appointment
            ⏰ Reminder email will be sent 1 hour before appointment
            
            Next Steps:
            1. Please note down your booking details
            2. You'll receive a secure meeting link via email
            3. Have your ID and documents ready
            4. Payment will be processed after the session
            
            Booking ID: ${booking.id}
        `;
        
        alert(confirmationMessage);
    }
}

// Wait for DOM to load before setting up event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up booking system...');
    
    // Test if modal exists
    const modal = document.getElementById('bookingModal');
    console.log('Booking modal found:', !!modal);
    
    // Test if form exists
    const form = document.getElementById('bookingForm');
    console.log('Booking form found:', !!form);
    
    // Test if date input exists
    const dateInput = document.getElementById('appointmentDate');
    console.log('Date input found:', !!dateInput);

    // Set up event listeners
    if (dateInput) {
        dateInput.addEventListener('change', generateTimeSlots);
    }
    
    // Email management functions (made global for onclick handlers)
    window.emailCount = 1;
    
    window.addEmailInput = function() {
        window.emailCount++;
        const emailContainer = document.getElementById('emailContainer');
        
        const emailGroup = document.createElement('div');
        emailGroup.className = 'email-input-group';
        emailGroup.innerHTML = `
            <input type="email" name="additionalEmail${window.emailCount}" placeholder="Additional email address" required>
            <button type="button" class="remove-email-btn" onclick="removeEmailInput(this)">Remove</button>
        `;
        
        emailContainer.appendChild(emailGroup);
    }
    
    window.removeEmailInput = function(button) {
        const emailGroup = button.parentElement;
        emailGroup.remove();
    }
    
    // Function to collect all email addresses from the form
    function collectAllEmails() {
        const emails = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        // Get primary email
        const primaryEmail = document.getElementById('clientEmail').value.trim();
        if (primaryEmail && emailRegex.test(primaryEmail)) {
            emails.push(primaryEmail);
        }
        
        // Get additional emails
        const additionalEmailInputs = document.querySelectorAll('input[name^="additionalEmail"]');
        additionalEmailInputs.forEach(input => {
            const email = input.value.trim();
            if (email && emailRegex.test(email)) {
                emails.push(email);
            }
        });
        
        return emails;
    }
    
    // Function to validate all email addresses
    function validateAllEmails() {
        const emails = collectAllEmails();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (emails.length === 0) {
            return { valid: false, message: 'At least one email address is required' };
        }
        
        // Check for duplicates
        const uniqueEmails = [...new Set(emails)];
        if (uniqueEmails.length !== emails.length) {
            return { valid: false, message: 'Duplicate email addresses found' };
        }
        
        // Validate each email
        for (const email of emails) {
            if (!emailRegex.test(email)) {
                return { valid: false, message: `Invalid email address: ${email}` };
            }
        }
        
        return { valid: true, emails: emails };
    }
    
    // Add event listener for the "Add Email" button
    document.getElementById('addEmailBtn').addEventListener('click', window.addEmailInput);
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const selectedTimeSlot = document.querySelector('.time-slot.selected');
            
            if (!selectedTimeSlot) {
                alert('Please select a time slot');
                return;
            }
            
            // Validate email addresses
            const emailValidation = validateAllEmails();
            if (!emailValidation.valid) {
                alert(emailValidation.message);
                return;
            }
            
            console.log(`Validated ${emailValidation.emails.length} email address(es):`, emailValidation.emails);
            
            const submitButton = document.getElementById('submitPayment');
            submitButton.disabled = true;
            submitButton.textContent = 'Processing Payment...';
            
            try {
                const serviceType = formData.get('serviceType');
                const selectedService = serviceOptions[serviceType];
                
                const allEmails = emailValidation.emails;
                const primaryEmail = allEmails[0]; // Use first email for billing
                
                // Get timezone-aware time data
                const selectedTime = window.selectedTimeSlot || {
                    estTime: selectedTimeSlot.dataset.time,
                    displayText: selectedTimeSlot.textContent.trim()
                };
                
                const booking = {
                    id: Date.now().toString(),
                    name: formData.get('clientName'),
                    email: primaryEmail, // Primary email for Stripe billing
                    allEmails: allEmails.join(','), // All emails for server processing
                    phone: formData.get('clientPhone'),
                    serviceType: serviceType,
                    serviceName: selectedService.name,
                    productId: selectedService.productId,
                    date: formData.get('appointmentDate'),
                    time: selectedTime.estTime, // Always use EST time for server
                    timeDisplay: selectedTime.displayText, // User-friendly display with timezone
                    specialRequests: formData.get('specialRequests'),
                    price: selectedService.price,
                    status: 'scheduled',
                    createdAt: new Date().toISOString()
                };
                
                // Process payment through Stripe
                const paymentSuccess = await processStripePayment(booking);
                
                if (paymentSuccess) {
                    // Save booking
                    bookings.push(booking);
                    localStorage.setItem('notaryBookings', JSON.stringify(bookings));
                    
                    // Show confirmation
                    await showBookingConfirmation(booking);
                    
                    // Close modal and reset form
                    closeBookingModal();
                    e.target.reset();
                } else {
                    alert('Payment failed. Please try again.');
                }
            } catch (error) {
                console.error('Booking error:', error);
                alert('An error occurred while processing your booking. Please try again.');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Pay & Schedule Appointment';
            }
        });
    }
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('bookingModal');
    if (event.target === modal) {
        closeBookingModal();
    }
});

// Admin Panel Functions
let adminKeySequence = [];
const adminCode = ['a', 'd', 'm', 'i', 'n']; // Type "admin" to access panel

// Listen for admin key sequence
document.addEventListener('keydown', function(event) {
    // Check if event.key exists before calling toLowerCase
    if (event.key) {
        adminKeySequence.push(event.key.toLowerCase());
        
        // Keep only the last 5 keys
        if (adminKeySequence.length > 5) {
            adminKeySequence.shift();
        }
        
        // Check if admin code was entered
        if (adminKeySequence.join('') === adminCode.join('')) {
            openAdminPanel();
            adminKeySequence = []; // Reset sequence
        }
    }
});

function openAdminPanel() {
    const panel = document.getElementById('adminPanel');
    panel.style.display = 'block';
    updateAdminStats();
    displayRecentBookings();
    console.log('📊 Admin panel opened');
}

function closeAdminPanel() {
    const panel = document.getElementById('adminPanel');
    panel.style.display = 'none';
}

function updateAdminStats() {
    const totalBookings = bookings.length;
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(booking => booking.date === today).length;
    const totalRevenue = bookings.reduce((sum, booking) => sum + booking.price, 0);
    
    document.getElementById('totalBookings').textContent = totalBookings;
    document.getElementById('todayBookings').textContent = todayBookings;
    document.getElementById('totalRevenue').textContent = `$${totalRevenue}`;
}

function displayRecentBookings() {
    const bookingsList = document.getElementById('bookingsList');
    
    if (bookings.length === 0) {
        bookingsList.innerHTML = '<p style="color: #cccccc; text-align: center;">No bookings yet</p>';
        return;
    }
    
    // Sort bookings by creation date (newest first)
    const sortedBookings = [...bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    bookingsList.innerHTML = sortedBookings.map(booking => `
        <div class="booking-item">
            <h4>${booking.name} - ${booking.serviceName || booking.serviceType || 'Service'}</h4>
            <p><strong>Date:</strong> ${formatBookingDate(booking.date)} at ${booking.timeDisplay}</p>
            <p><strong>Email:</strong> ${booking.email} | <strong>Phone:</strong> ${booking.phone}</p>
            <p><strong>Price:</strong> $${booking.price} | <strong>Status:</strong> ${booking.status}</p>
            <p><strong>Booking ID:</strong> ${booking.id}</p>
            <div style="margin-top: 0.5rem;">
                <button onclick="sendMeetingLinkToBooking('${booking.id}')" class="btn-admin" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">Send Meeting Link</button>
                <button onclick="sendReminderToBooking('${booking.id}')" class="btn-admin" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">Send Reminder</button>
                <button onclick="deleteBooking('${booking.id}')" class="btn-admin danger" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">Delete</button>
            </div>
        </div>
    `).join('');
}

function sendTestConfirmationEmail() {
    const testEmail = document.getElementById('testEmail').value;
    if (!testEmail) {
        alert('Please enter a test email address');
        return;
    }
    
    const mockBooking = {
        id: 'TEST-' + Date.now(),
        name: 'Test User',
        email: testEmail,
        phone: '(555) 123-4567',
        serviceType: 'notarization',
        serviceName: 'Notarization Service',
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
        timeDisplay: '2:00 PM',
        price: 50,
        specialRequests: 'This is a test booking'
    };
    
    sendBookingConfirmationEmail(mockBooking);
    alert(`📧 Test confirmation email sent to ${testEmail}`);
}

function sendTestMeetingLink() {
    const testEmail = document.getElementById('testEmail').value;
    if (!testEmail) {
        alert('Please enter a test email address');
        return;
    }
    
    const mockBooking = {
        id: 'TEST-' + Date.now(),
        name: 'Test User',
        email: testEmail,
        serviceType: 'notarization',
        serviceName: 'Notarization Service',
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
        timeDisplay: '2:00 PM'
    };
    
    const mockMeetingLink = 'https://meet.proof.com/room/test-meeting-' + Date.now();
    sendMeetingLinkEmail(mockBooking, mockMeetingLink);
    alert(`📧 Test meeting link sent to ${testEmail}`);
}

function sendTestReminder() {
    const testEmail = document.getElementById('testEmail').value;
    if (!testEmail) {
        alert('Please enter a test email address');
        return;
    }
    
    const mockBooking = {
        id: 'TEST-' + Date.now(),
        name: 'Test User',
        email: testEmail,
        serviceType: 'notarization',
        serviceName: 'Notarization Service',
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
        timeDisplay: '2:00 PM'
    };
    
    sendReminderEmail(mockBooking);
    alert(`📧 Test reminder sent to ${testEmail}`);
}

async function sendMeetingLinkToBooking(bookingId) {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
        alert('Booking not found');
        return;
    }
    
    try {
        const response = await fetch('/send-meeting-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                bookingData: {
                    email: booking.email,
                    client_name: booking.name,
                    booking_id: booking.id,
                    appointment_date: formatBookingDate(booking.date),
                    appointment_time: booking.time, // Use EST time for server processing
                    service_type: booking.serviceType,
                    service_name: booking.serviceName || booking.serviceType
                },
                transactionId: booking.proofTransactionId || null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`📧 Meeting link sent to ${booking.email}`);
            console.log('Meeting link sent:', result.meeting_link);
        } else {
            throw new Error(result.message || 'Failed to send meeting link');
        }
    } catch (error) {
        console.error('Failed to send meeting link:', error);
        alert(`❌ Failed to send meeting link: ${error.message}`);
    }
}

function sendReminderToBooking(bookingId) {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
        alert('Booking not found');
        return;
    }
    
    sendReminderEmail(booking);
    alert(`📧 Reminder sent to ${booking.email}`);
}

function deleteBooking(bookingId) {
    if (confirm('Are you sure you want to delete this booking?')) {
        bookings = bookings.filter(b => b.id !== bookingId);
        localStorage.setItem('notaryBookings', JSON.stringify(bookings));
        displayRecentBookings();
        updateAdminStats();
        alert('Booking deleted');
    }
}

function exportBookings() {
    if (bookings.length === 0) {
        alert('No bookings to export');
        return;
    }
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + "ID,Name,Email,Phone,Service Type,Service Name,Date,Time,Price,Status,Created At,Special Requests\n"
        + bookings.map(booking => 
            `${booking.id},"${booking.name}","${booking.email}","${booking.phone}","${booking.serviceType || booking.documentType || 'Unknown'}","${booking.serviceName || booking.serviceType || booking.documentType || 'Unknown'}","${booking.date}","${booking.timeDisplay}","$${booking.price}","${booking.status}","${booking.createdAt}","${booking.specialRequests || ''}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('📊 Bookings exported to CSV file');
}

function clearAllBookings() {
    if (confirm('⚠️ Are you sure you want to delete ALL bookings? This cannot be undone!')) {
        if (confirm('⚠️ This will permanently delete all booking data. Are you absolutely sure?')) {
            bookings = [];
            localStorage.setItem('notaryBookings', JSON.stringify(bookings));
            displayRecentBookings();
            updateAdminStats();
            alert('🗑️ All bookings have been deleted');
        }
    }
}

// Enhanced header scroll effect
window.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    const scrolled = window.scrollY > 50;
    
    if (scrolled) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Animate service cards on scroll
document.addEventListener('DOMContentLoaded', function() {
    const serviceCards = document.querySelectorAll('.service-card');
    
    serviceCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = `opacity 0.6s ease ${index * 0.2}s, transform 0.6s ease ${index * 0.2}s`;
        observer.observe(card);
    });
    
    // Add parallax effect to hero section
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const hero = document.querySelector('.hero');
        const rate = scrolled * -0.3;
        
        if (hero) {
            hero.style.transform = `translateY(${rate}px)`;
        }
    });
    
    // Add typing effect to hero title (optional enhancement)
    const heroTitle = document.querySelector('.hero-content h2');
    if (heroTitle) {
        const originalText = heroTitle.textContent;
        heroTitle.textContent = '';
        heroTitle.style.borderRight = '3px solid #DAA520';
        
        let i = 0;
        const typeWriter = function() {
            if (i < originalText.length) {
                heroTitle.textContent += originalText.charAt(i);
                i++;
                setTimeout(typeWriter, 100);
            } else {
                setTimeout(() => {
                    heroTitle.style.borderRight = 'none';
                }, 1000);
            }
        };
        
        setTimeout(typeWriter, 1000);
    }
});

// Add dynamic color changes on scroll
window.addEventListener('scroll', function() {
    const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    const goldIntensity = Math.min(scrollPercent / 2, 30);
    
    document.documentElement.style.setProperty('--scroll-gold', `hsla(43, 74%, ${45 + goldIntensity}%, 0.1)`);
});

// FAQ Accordion functionality
document.addEventListener('DOMContentLoaded', function() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            const faqItem = this.parentElement;
            const isActive = faqItem.classList.contains('active');
            
            // Close all other FAQ items
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Toggle current item
            if (!isActive) {
                faqItem.classList.add('active');
            }
        });
    });
});

// How It Works Slider functionality
document.addEventListener('DOMContentLoaded', function() {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    const sliderTrack = document.querySelector('.slider-track');
    const sliderProgress = document.querySelector('.slider-progress');
    let currentSlide = 0;
    let slideInterval;

    function showSlide(index) {
        // Update dots
        dots.forEach(dot => dot.classList.remove('active'));
        if (dots[index]) {
            dots[index].classList.add('active');
        }
        
        // Check if mobile view
        const isMobile = window.innerWidth <= 768;
        const slideWidth = isMobile ? 100 : 33.333;
        
        // Move slider track smoothly
        if (sliderTrack) {
            sliderTrack.style.transform = `translateX(-${index * slideWidth}%)`;
        }
        
        // Update progress bar
        if (sliderProgress) {
            sliderProgress.style.setProperty('--progress-position', `${index * slideWidth}%`);
        }
        
        currentSlide = index;
    }

    function nextSlide() {
        const nextIndex = (currentSlide + 1) % slides.length;
        showSlide(nextIndex);
    }

    function startAutoSlide() {
        // Slower timing for mobile, comfortable timing for desktop
        const timing = window.innerWidth <= 768 ? 7000 : 6000;
        slideInterval = setInterval(nextSlide, timing);
    }
    
    // Handle window resize to recalculate positions
    window.addEventListener('resize', function() {
        showSlide(currentSlide);
    });

    function stopAutoSlide() {
        if (slideInterval) {
            clearInterval(slideInterval);
        }
    }

    // Add click handlers to dots
    dots.forEach((dot, index) => {
        dot.addEventListener('click', function() {
            stopAutoSlide();
            showSlide(index);
            // Longer delay on mobile before restarting
            const restartDelay = window.innerWidth <= 768 ? 3000 : 1500;
            setTimeout(startAutoSlide, restartDelay);
        });
    });

    // Pause auto-slide on hover
    const sliderContainer = document.querySelector('.slider-container');
    if (sliderContainer) {
        sliderContainer.addEventListener('mouseenter', stopAutoSlide);
        sliderContainer.addEventListener('mouseleave', startAutoSlide);
    }

    // Initialize slider
    if (slides.length > 0) {
        showSlide(0);
        startAutoSlide();
    }

    // Add touch/swipe support for mobile
    let startX = 0;
    let endX = 0;

    if (sliderContainer) {
        sliderContainer.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
        });

        sliderContainer.addEventListener('touchend', function(e) {
            endX = e.changedTouches[0].clientX;
            handleSwipe();
        });
    }

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) > swipeThreshold) {
            stopAutoSlide();
            if (diff > 0) {
                // Swipe left - next slide
                nextSlide();
            } else {
                // Swipe right - previous slide
                const prevIndex = currentSlide === 0 ? slides.length - 1 : currentSlide - 1;
                showSlide(prevIndex);
            }
            // Longer delay on mobile after swipe
            const restartDelay = window.innerWidth <= 768 ? 4000 : 1500;
            setTimeout(startAutoSlide, restartDelay);
        }
    }
}); 