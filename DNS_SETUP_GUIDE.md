# 🌐 Custom Domain + SendGrid Setup Guide

## Step 1: Domain Registration (Recommended: Namecheap - $8.88)

### Register Your Domain
1. Go to [Namecheap.com](https://namecheap.com)
2. Search for your preferred domain:
   - `remotenotaryfl.com`
   - `remotenotaryservices.com` 
   - `enotaryfl.com`
3. Add to cart, use coupon **NEWCOM698** if available
4. Complete purchase

## Step 2: Configure DNS Records in Namecheap

### Access DNS Management
1. Login to Namecheap account
2. Go to "Dashboard" → "Manage" next to your domain
3. Click "Advanced DNS" tab

### Add These Exact Records

```dns
# Point domain to Azure App Service
Type: A Record
Host: @
Value: 20.48.204.1
TTL: 30 min

# Point www to Azure
Type: CNAME Record  
Host: www
Value: remotenotaryfl.azurewebsites.net
TTL: 30 min

# SendGrid Email Authentication Records
Type: CNAME Record
Host: em5191
Value: u53889248.wl249.sendgrid.net
TTL: 30 min

Type: CNAME Record
Host: s1._domainkey
Value: s1.domainkey.u53889248.wl249.sendgrid.net
TTL: 30 min

Type: CNAME Record
Host: s2._domainkey
Value: s2.domainkey.u53889248.wl249.sendgrid.net
TTL: 30 min

Type: TXT Record
Host: _dmarc
Value: v=DMARC1; p=none;
TTL: 30 min
```

### Example Namecheap DNS Setup:
```
A Record     @              20.48.204.1               30 min
CNAME        www            remotenotaryfl.azurewebsites.net    30 min
CNAME        em5191         u53889248.wl249.sendgrid.net       30 min
CNAME        s1._domainkey  s1.domainkey.u53889248.wl249.sendgrid.net  30 min
CNAME        s2._domainkey  s2.domainkey.u53889248.wl249.sendgrid.net  30 min
TXT          _dmarc         v=DMARC1; p=none;         30 min
```

## Step 3: Add Domain to Azure App Service

### Using Azure CLI (after DNS setup):
```bash
# Replace 'yourdomain.com' with your actual domain
az webapp config hostname add --webapp-name remotenotaryfl --resource-group RemoteNotaryFL-rg --hostname yourdomain.com

# Add www subdomain too
az webapp config hostname add --webapp-name remotenotaryfl --resource-group RemoteNotaryFL-rg --hostname www.yourdomain.com
```

### Using Azure Portal:
1. Go to [portal.azure.com](https://portal.azure.com)
2. Navigate to your App Service "remotenotaryfl"
3. Go to "Custom domains" in left menu
4. Click "Add custom domain"
5. Enter your domain name
6. Click "Validate"
7. Click "Add custom domain"

## Step 4: Enable SSL Certificate

### Free SSL from Azure:
```bash
# Enable free SSL certificate
az webapp config ssl create --resource-group RemoteNotaryFL-rg --name remotenotaryfl --hostname yourdomain.com

# Bind SSL certificate
az webapp config ssl bind --resource-group RemoteNotaryFL-rg --name remotenotaryfl --certificate-thumbprint [THUMBPRINT] --ssl-type SNI
```

Or use Azure Portal:
1. Go to "TLS/SSL settings" in your App Service
2. Click "Private Key Certificates (.pfx)"
3. Click "Create App Service Managed Certificate"
4. Select your domain
5. Create certificate
6. Go to "Bindings" tab
7. Add TLS/SSL binding for your domain

## Step 5: Update Website Configuration

### Update script.js with your domain:
Replace the contact information in your website with your custom domain:

```javascript
// Update email addresses to use your custom domain
const BUSINESS_EMAIL = 'info@yourdomain.com';
const SUPPORT_EMAIL = 'support@yourdomain.com';
```

## Step 6: Test Domain Setup

### DNS Propagation Check:
1. Go to [whatsmydns.net](https://whatsmydns.net)
2. Enter your domain
3. Check A record shows: 20.48.204.1
4. Wait for green checkmarks worldwide (up to 48 hours)

### Website Test:
1. Visit `https://yourdomain.com`
2. Should show your notary website
3. Check SSL certificate is working (green lock)

## Step 7: SendGrid Email Setup

### Configure SendGrid API:
1. Login to SendGrid account
2. Go to Settings → API Keys
3. Create new API key with "Full Access"
4. Copy API key for website integration

### Update Email Integration:
Replace EmailJS with SendGrid API in your website code.

## Timeline & Costs

### Immediate (0-2 hours):
- ✅ Register domain: **$8.88/year**
- ✅ Configure DNS records: **Free**
- ✅ Add to Azure: **Free**

### Within 24-48 hours:
- ✅ DNS propagation complete
- ✅ SSL certificate active
- ✅ Professional emails working

### Total Annual Cost:
- **Domain**: $8.88/year (Namecheap)
- **SendGrid**: Free up to 100 emails/day
- **Azure hosting**: ~$10-20/month (existing)
- **SSL Certificate**: Free (Azure managed)

## Troubleshooting

### DNS Not Working?
- Wait 24-48 hours for propagation
- Check TTL settings (use 30 min for faster updates)
- Verify A record points to correct IP: 20.48.204.1

### SSL Issues?
- Ensure DNS is fully propagated first
- Try creating certificate through Azure Portal
- Check domain verification in Azure

### SendGrid Authentication Failed?
- Verify all CNAME records are correct
- Check SendGrid dashboard for verification status
- May take up to 48 hours to verify

## Support Contacts

- **Namecheap Support**: Live chat available 24/7
- **Azure Support**: [portal.azure.com](https://portal.azure.com) → Support
- **SendGrid Support**: [sendgrid.com/support](https://sendgrid.com/support)

---

🎉 **Result**: Professional domain with authenticated email sending for under $10/year! 