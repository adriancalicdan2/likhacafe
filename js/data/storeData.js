// ============================================
// LIKHĀ CAFÉ - STORE CONFIGURATION
// ============================================

const storeData = {
  name: 'Likhā Café',
  tagline: 'Coffee · Comfort · Connection',
  motto: 'Good Coffee. Good Food. Good Vibes. That\'s Likha. ❤️',
  location: 'Imus, Philippines, 4103',
  contact: '0927 965 1044',
  email: 'marcobee.ph@gmail.com',
  social: '@likha_cafe',
  currency: '₱',
  
  // Tax rates
  taxRate: 0.12,        // 12% VAT
  takeoutTaxRate: 0.05, // 5% additional takeout tax
  
  // Operating hours
  hours: {
    tue: '10:00 AM - 2:00 AM',
    wed: '10:00 AM - 2:00 AM',
    thu: '10:00 AM - 2:00 AM',
    fri: '10:00 AM - 2:00 AM',
    sat: '10:00 AM - 2:00 AM',
    sun: '10:00 AM - 2:00 AM',
    mon: 'Closed'
  },
  hoursDisplay: 'Tue-Sun, 10:00 AM - 2:00 AM',
  
  // Theme colors
  colors: {
    primary: '#6F4E37',
    secondary: '#D4A373',
    white: '#FFFFFF'
  },
  
  // Receipt configuration
  receipt: {
    header: 'Likhā Café',
    tagline: 'Coffee · Comfort · Connection',
    footer: 'Made for coffee dates, tambay sessions, late-night cravings. ❤️',
    social: '@likha_cafe',
    thankYou: '☕ Thank you for your order!'
  },
  
  // Table configuration
  tables: 10 // Total number of tables
};

export default storeData;

