import React, { useState } from 'react';
import { 
  X, Send, MessageSquare, MessageCircle, 
  Sparkles, Check, Users, Tag, Gift,
  Percent, Clock, Calendar, Star, TrendingUp,
  ShoppingBag, Zap, Megaphone, Target
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  content: string;
}

const AI_TEMPLATES: Template[] = [
  // PROMOTIONS
  {
    id: 'promo_sale',
    name: 'Flash Sale',
    category: 'Promotions',
    description: 'Limited-time discount offer',
    content: "⚡ FLASH SALE ALERT! ⚡\n\nHi [Customer Name]! 🌟\n\nFor the next 24 hours only, get [X]% OFF all items at [Company Name]! 🛍️\n\nDon't miss out on our best deals of the year. Offer ends at midnight!\n\nShop now and save big! 💰\n\nReply 'YES' to claim your discount!"
  },
  {
    id: 'promo_newarrival',
    name: 'New Arrival',
    category: 'Promotions',
    description: 'Announce new product arrivals',
    content: "🌟 NEW ARRIVALS ALERT! 🌟\n\nHi [Customer Name]!\n\nExciting news from [Company Name]! We've just received our fresh collection of [Product Name]!\n\n✅ Premium Quality\n✅ Best Prices\n✅ Limited Stock\n\nBe the first to get your hands on these amazing products!\n\nReply 'NEW' to see our catalog!"
  },
  {
    id: 'promo_bundldeal',
    name: 'Bundle Deal',
    category: 'Promotions',
    description: 'Buy one get one offers',
    content: "🎁 BUNDLE DEAL ALERT! 🎁\n\nHi [Customer Name]!\n\nAt [Company Name], we're offering a BUY 1 GET 1 FREE deal on selected items!\n\nThat's right - double the value for the same price!\n\n🛒 Shop now\n⏰ Ends soon\n\nDon't miss this amazing offer!\n\nReply 'BUNDLE' for details"
  },
  {
    id: 'promo_clearance',
    name: 'Clearance Sale',
    category: 'Promotions',
    description: 'Clearance and end-of-season sale',
    content: "🏷️ CLEARANCE SALE! 🏷️\n\nHi [Customer Name]!\n\nHuge savings at [Company Name]! Up to [X]% OFF on clearance items!\n\n📦 Limited stock available\n💰 Unbeatable prices\n🎯 While supplies last\n\nClear your shopping list with our amazing deals!"
  },
  // SPECIAL OFFERS
  {
    id: 'offer_firstorder',
    name: 'First Order Discount',
    category: 'Special Offers',
    description: 'Welcome offer for new customers',
    content: "🎉 WELCOME OFFER! 🎉\n\nHi [Customer Name]! Welcome to [Company Name]!\n\nAs our valued new customer, enjoy an EXCLUSIVE [X]% OFF your first order!\n\nUse code: WELCOME[X]\n\nWe can't wait to serve you!\n\nShop now 👉 [Website]"
  },
  {
    id: 'offer_loyalty',
    name: 'Loyalty Reward',
    category: 'Special Offers',
    description: 'Reward loyal customers',
    content: "💎 THANK YOU FROM [Company Name]! 💎\n\nHi [Customer Name]!\n\nAs one of our valued customers, you've earned a special reward!\n\n🎁 Get [X]% OFF your next order\n\nUse code: THANKS[X]\n\nWe appreciate your continued support!"
  },
  {
    id: 'offer_referral',
    name: 'Refer a Friend',
    category: 'Special Offers',
    description: 'Referral program promotion',
    content: "🤝 REFER A FRIEND! 🤝\n\nHi [Customer Name]!\n\nShare the love with [Company Name]! Refer a friend and you'll BOTH get [X]% OFF your next order!\n\nIt's our way of saying thank you for spreading the word!\n\nAsk your friends to mention your name when they order."
  },
  {
    id: 'offer_vip',
    name: 'VIP Exclusive',
    category: 'Special Offers',
    description: 'Exclusive offer for VIP customers',
    content: "👑 VIP EXCLUSIVE! 👑\n\nHi [Customer Name]!\n\nAs our cherished VIP customer, we're giving you early access to our biggest sale of the year!\n\n🎯 [X]% OFF everything\n⏰ 48-hour early access\n\nShop before everyone else!\n\nReply 'VIP' to shop now"
  },
  {
    id: 'offer_birthday',
    name: 'Birthday Special',
    category: 'Special Offers',
    description: 'Birthday discount offer',
    content: "🎂 HAPPY BIRTHDAY! 🎂\n\nHi [Customer Name]!\n\n[Wishing you an amazing birthday from [Company Name]! 🎉\n\nAs our gift to you, enjoy [X]% OFF your next order!\n\n\nUse code: BIRTHDAY[X]\n\nTreat yourself today! 🎁"
  },
  {
    id: 'offer_seasonal',
    name: 'Seasonal Offer',
    category: 'Special Offers',
    description: 'Holiday season promotion',
    content: "🎄 [Season] SPECIAL! 🎄\n\nHi [Customer Name]!\n\nCelebrate [Season] with amazing deals at [Company Name]!\n\n❄️ Up to [X]% OFF\n🎁 Free gifts with purchase\n🚚 Free delivery\n\nShop now and spread the joy!"
  },
  // ANNOUNCEMENTS
  {
    id: 'ann_storeopen',
    name: 'Grand Opening',
    category: 'Announcements',
    description: 'New store opening announcement',
    content: "🎉 GRAND OPENING! 🎉\n\n\nHi [Customer Name]!\n\n[Company Name] is EXCITED to announce our GRAND OPENING!\n\n📍 [Address]\n📅 [Date]\n⏰ [Time]\n\n🎁 Amazing opening day specials!\n🍰 Free refreshments\n🎈 Prize draws\n\nBe there for the celebration!"
  },
  {
    id: 'ann_website',
    name: 'New Website',
    category: 'Announcements',
    description: 'New website launch',
    content: "🌐 NEW WEBSITE LAUNCH! 🌐\n\nHi [Customer Name]!\n\nWe're thrilled to announce our brand new website!\n\n✨ Sleeker design\n✨ Easier ordering\n✨ Exclusive online deals\n\nCheck it out now 👉 [Website]\n\nUse code: NEWWEB[X] for [X]% off!"
  },
  {
    id: 'ann_service',
    name: 'New Service',
    category: 'Announcements',
    description: 'New service offering',
    content: "✨ NEW SERVICE ALERT! ✨\n\nHi [Customer Name]!\n\n[Company Name] is excited to announce our newest service: [Service Name]!\n\n✅ [Benefit 1]\n✅ [Benefit 2]\n✅ [Benefit 3]\n\nExperience the difference today!\n\nReply 'SERVICE' for details"
  },
  {
    id: 'ann_award',
    name: 'Award Win',
    category: 'Announcements',
    description: 'Award or certification announcement',
    content: "🏆 EXCITING NEWS! 🏆\n\n\nHi [Customer Name]!\n\n[Company Name] is proud to announce that we've won the [Award Name]!\n\nThis Recognition Belongs to YOU - our amazing customers!\n\nThank you for your continued support!"
  },
  {
    id: 'ann_expansion',
    name: 'Business Expansion',
    category: 'Announcements',
    description: 'Business growth announcement',
    content: "📈 WE'RE GROWING! 📈\n\nHi [Customer Name]!\n\nGreat things happening at [Company Name]! We've expanded to serve you better!\n\n🏢 New location: [Address]\n📞 Contact: [Phone]\n\nVisit us at our new location!"
  },
  // REMINDERS
  {
    id: 'reminder_abandoned',
    name: 'Cart Reminder',
    category: 'Reminders',
    description: 'Cart abandonment reminder',
    content: "😔 Did you forget something? 😔\n\nHi [Customer Name]!\n\nWe noticed you left items in your cart at [Company Name].\n\nYour items are waiting for you:\n[Item List]\n\nComplete your order now and don't miss out! 🛒"
  },
  {
    id: 'reminder_review',
    name: 'Review Request',
    category: 'Reminders',
    description: 'Request customer review',
    content: "⭐ WE VALUE YOUR FEEDBACK! ⭐\n\nHi [Customer Name]!\n\nThank you for your recent order #[Order Number] from [Company Name].\n\nWe'd love to hear about your experience! It only takes a minute.\n\n[Review Link]\n\nThank you for being awesome! 🙌"
  },
  {
    id: 'reminder_restock',
    name: 'Back in Stock',
    category: 'Reminders',
    description: 'Item back in stock notification',
    content: "✅ IT'S BACK IN STOCK! ✅\n\nHi [Customer Name]!\n\nGreat news! The [Product Name] you asked about is now available at [Company Name]!\n\n🛒 Order now before it sells out\n\nReply 'BUY' to order!"
  },
  {
    id: 'reminder_followup',
    name: 'Order Follow-up',
    category: 'Reminders',
    description: 'Post-purchase follow-up',
    content: "📦 ORDER #[Order Number] CONFIRMED! 📦\n\nHi [Customer Name]!\n\nYour order from [Company Name] has been shipped and is on its way!\n\n\nTracking: [Tracking Link]\n\nExpected delivery: [Date]\n\nThank you for shopping with us!"
  },
  {
    id: 'reminder_service',
    name: 'Service Reminder',
    category: 'Reminders',
    description: 'Service appointment reminder',
    content: "📅 SERVICE REMINDER 📅\n\nHi [Customer Name]!\n\nJust a friendly reminder about your upcoming appointment:\n\n📍 [Company Name]\n📅 [Date]\n⏰ [Time]\n\nSee you soon! Reply to confirm or reschedule."
  },
  // GENERAL BUSINESS
  {
    id: 'biz_welcome',
    name: 'Welcome Message',
    category: 'General',
    description: 'Welcome new customers',
    content: "👋 WELCOME TO [Company Name]! 👋\n\nHi [Customer Name]!\n\nThank you for choosing us! We're thrilled to have you as a customer.\n\n🛒 Browse our products\n❓ Ask any questions\n💬 We're here to help!\n\nYour satisfaction is our priority!"
  },
  {
    id: 'biz_thankyou',
    name: 'Thank You',
    category: 'General',
    description: 'Thank you message',
    content: "🙏 THANK YOU! 🙏\n\nHi [Customer Name]!\n\nThank you for your recent purchase from [Company Name].\n\nWe truly appreciate your business and look forward to serving you again!\n\n💬 Have questions? Reply anytime!"
  },
  {
    id: 'biz_inquiry',
    name: 'Product Inquiry',
    category: 'General',
    description: 'Respond to product inquiry',
    content: "📦 PRODUCT INFORMATION 📦\n\nHi [Customer Name]!\n\nThank you for your interest in [Product Name] from [Company Name]!\n\n💰 Price: [Price]\n📦 Stock: [Stock Status]\n🎁 Features: [Features]\n\nWould you like to place an order? Reply 'YES'!"
  },
  {
    id: 'biz_catalog',
    name: 'Catalog Request',
    category: 'General',
    description: 'Send product catalog',
    content: "📚 HERE'S OUR CATALOG! 📚\n\nHi [Customer Name]!\n\nThanks for your interest in [Company Name]!\n\nBrowse our complete collection here:\n[Catalog Link]\n\nOr reply 'SPECIFIC' for products in [Category]"
  },
  {
    id: 'biz_quote',
    name: 'Price Quote',
    category: 'General',
    description: 'Send price quotation',
    content: "💵 PRICE QUOTATION 💵\n\nHi [Customer Name]!\n\nThank you for your inquiry at [Company Name]. Here's your quote:\n\n📦 Items:\n[Item List]\n\n💰 Total: [Total Price]\n📅 Valid until: [Date]\n\nReply to place your order!"
  },
  // URGENT / LIMITED
  {
    id: 'urgent_lowstock',
    name: 'Low Stock Alert',
    category: 'Urgent',
    description: 'Item running low',
    content: "⏰ ALMOST GONE! ⏰\n\nHi [Customer Name]!\n\nHurry! [Product Name] from [Company Name] is running low in stock!\n\n��� Only [X] units left\n💰 Price: [Price]\n\nOrder now before it's sold out!"
  },
  {
    id: 'urgent_deadline',
    name: 'Deadline Reminder',
    category: 'Urgent',
    description: 'Offer ending soon',
    content: "⏰ LAST CHANCE! ⏰\n\nHi [Customer Name]!\n\nThis is your final reminder! Our [Promotion Name] ends in [X] hours!\n\n🎯 Don't miss [X]% OFF\n\n[Company Name]\n\nOrder now before it's too late!"
  },
  {
    id: 'urgent_priceincrease',
    name: 'Price Increase Warning',
    category: 'Urgent',
    description: 'Upcoming price increase',
    content: "📢 PRICE ADJUSTMENT NOTICE 📢\n\nHi [Customer Name]!\n\nDue to market changes, prices will increase soon at [Company Name].\n\nCurrent price: [Current Price]\nNew price: [New Price]\nEffective: [Date]\n\nOrder now to lock in the current price!"
  },
  // FEEDBACK & SURVEYS
  {
    id: 'survey_feedback',
    name: 'Feedback Request',
    category: 'Surveys',
    description: 'Customer feedback request',
    content: "📝 QUICK QUESTION 📝\n\nHi [Customer Name]!\n\nWe'd love your feedback on [Company Name]!\n\nIt only takes 2 minutes:\n[Survey Link]\n\nAs a thank you, get [X]% off your next order with code: FEEDBACK[X]"
  },
  {
    id: 'survey_satisfaction',
    name: 'Satisfaction Survey',
    category: 'Surveys',
    description: 'Customer satisfaction survey',
    content: "⭐ HOW DID WE DO? ⭐\n\nHi [Customer Name]!\n\nYour opinion matters to us at [Company Name]. Help us serve you better!\n\nTake our short survey:\n[Survey Link]\n\nThank you for your time!"
  },
  // SEASONAL / HOLIDAY
  {
    id: 'season_newyear',
    name: 'New Year Sale',
    category: 'Seasonal',
    description: 'New Year promotion',
    content: "🎆 HAPPY NEW YEAR! 🎆\n\nHi [Customer Name]!\n\nStart the year right with amazing deals at [Company Name]!\n\n🎁 New Year Sale - Up to [X]% OFF\n\nNew year, new you, new purchases!\n\nShop now!"
  },
  {
    id: 'season_valentine',
    name: 'Valentine Offer',
    category: 'Seasonal',
    description: 'Valentine Day promotion',
    content: "💕 VALENTINE'S DAY 💕\n\nHi [Customer Name]!\n\nShow your love with gifts from [Company Name]!\n\n💝 Special Valentine's deals\n🎁 Gift wrapping FREE\n📅 Delivery by [Date]\n\nFind the perfect gift today!"
  },
  {
    id: 'season_mother',
    name: "Mother's Day",
    category: 'Seasonal',
    description: "Mother's Day promotion",
    content: "🌸 HAPPY MOTHER'S DAY! 🌸\n\nHi [Customer Name]!\n\nHonor the special women in your life with gifts from [Company Name]!\n\n💐 Mother's Day specials\n🎁 Extra gifts with orders over [Amount]\n\nMake her day special!"
  },
  {
    id: 'season_father',
    name: "Father's Day",
    category: 'Seasonal',
    description: "Father's Day promotion",
    content: "👔 HAPPY FATHER'S DAY! 👔\n\nHi [Customer Name]!\n\nGift Dad something amazing from [Company Name]!\n\n🎁 Father's Day deals\n🎩 Dad-approved picks\n\nShow Dad you care!"
  },
  {
    id: 'season_backtoschool',
    name: 'Back to School',
    category: 'Seasonal',
    description: 'Back to school promotion',
    content: "🎒 BACK TO SCHOOL! 🎒\n\nHi [Customer Name]!\n\nGet ready for the new school year with [Company Name]!\n\n📚 School supplies\n✏️ Best brands\n💰 Student discounts\n\nShop smart, shop [Company Name]!"
  },
  {
    id: 'season_blackfriday',
    name: 'Black Friday',
    category: 'Seasonal',
    description: 'Black Friday sale',
    content: "🛒 BLACK FRIDAY! 🛒\n\nHi [Customer Name]!\n\nTHE biggest sale of the year is HERE at [Company Name]!\n\n🔥 Up to [X]% OFF\n🚚 Free shipping\n💰 Doorbusters\n\nShop the best deals!"
  },
  {
    id: 'season_cybermonday',
    name: 'Cyber Monday',
    category: 'Seasonal',
    description: 'Cyber Monday sale',
    content: "💻 CYBER MONDAY! 💻\n\nHi [Customer Name]!\n\nDon't miss our online-exclusive deals at [Company Name]!\n\n💻 Tech deals\n🔥 [X]% OFF everything\n📦 Fast delivery\n\nShop online now!"
  },
  {
    id: 'season_christmas',
    name: 'Christmas Sale',
    category: 'Seasonal',
    description: 'Christmas holiday promotion',
    content: "🎄 MERRY CHRISTMAS! 🎄\n\nHi [Customer Name]!\n\nHoliday savings at [Company Name]!\n\n🎁 Holiday specials\n🎁 Free gift wrapping\n🎁 Express delivery\n\nShop for gifts they love!"
  },
  // RETENTION
  {
    id: 'retention_winback',
    name: 'Win Back',
    category: 'Retention',
    description: 'Win back inactive customers',
    content: "🥺 WE MISS YOU! 🥺\n\nHi [Customer Name]!\n\nIt's been a while since we saw you at [Company Name].\n\nWe'd love to have you back!\n\n🎁 [X]% off just for returning\n\nCome see us soon!"
  },
  {
    id: 'retention_reactivation',
    name: 'Reactivation',
    category: 'Retention',
    description: 'Re-engage dormant customers',
    content: "🔄 WE'RE BACK! 🔄\n\nHi [Customer Name]!\n\n[Company Name] has been working on some exciting new things!\n\n✨ New products\n✨ Better prices\n✨ Special offers\n\nTime to reconnect!"
  },
  // APPOINTMENTS & BOOKINGS
  {
    id: 'booking_confirm',
    name: 'Booking Confirm',
    category: 'Bookings',
    description: 'Appointment confirmation',
    content: "✅ BOOKING CONFIRMED! ✅\n\nHi [Customer Name]!\n\nYour appointment at [Company Name] is confirmed:\n\n📅 Date: [Date]\n⏰ Time: [Time]\n📍 Location: [Address]\n\nSee you then! Reply to reschedule."
  },
  {
    id: 'booking_reminder',
    name: 'Booking Reminder',
    category: 'Bookings',
    description: 'Upcoming booking reminder',
    content: "📅 REMINDER: Your appointment 📅\n\nHi [Customer Name]!\n\nJust a reminder about your booking:\n\n📍 [Company Name]\n📅 [Date] at [Time]\n\nWe look forward to seeing you!"
  },
  // CUSTOMER SERVICE
  {
    id: 'support_welcome',
    name: 'Support Welcome',
    category: 'Support',
    description: 'Customer support greeting',
    content: "💬 WELCOME TO SUPPORT! 💬\n\nHi [Customer Name]!\n\nWelcome to [Company Name] Customer Support! 👋\n\nHow can we help you today?\n- Ask about an order\n- Product questions\n- Returns & refunds\n\nWe're here to help!"
  },
  {
    id: 'support_followup',
    name: 'Support Follow-up',
    category: 'Support',
    description: 'Support ticket follow-up',
    content: "📞 SUPPORT UPDATE 📞\n\nHi [Customer Name]!\n\nRegarding your inquiry #[Ticket Number], we're working on it!\n\n📋 Status: [Status]\n⏰ ETA: [Time]\n\nThank you for your patience!"
  },
  {
    id: 'support_resolved',
    name: 'Issue Resolved',
    category: 'Support',
    description: 'Issue resolution notification',
    content: "✅ ISSUE RESOLVED! ✅\n\nHi [Customer Name]!\n\nGreat news! Your issue has been resolved.\n\n📋 Resolution: [Details]\n\nThank you for your patience. Is there anything else we can help with?"
  },
  {
    id: 'support_refund',
    name: 'Refund Processed',
    category: 'Support',
    description: 'Refund notification',
    content: "💰 REFUND PROCESSED! 💰\n\nHi [Customer Name]!\n\nYour refund has been processed!\n\n💵 Amount: [Amount]\n📅 Processing time: [Date]\n\nIt should appear in your account within [Time]."
  },
  // WHATSAPP SPECIFIC
  {
    id: 'wa_welcome',
    name: 'WhatsApp Welcome',
    category: 'WhatsApp',
    description: 'First WhatsApp message',
    content: "👋 HI! WELCOME TO [Company Name]! 👋\n\nThanks for messaging us! We're excited to help you.\n\nQuick intro:\n🛒 Browse our products\n❓ Ask questions\n📦 Track orders\n💬 Get support\n\nWhat would you like to do today?"
  },
  {
    id: 'wa_catalogue',
    name: 'WhatsApp Catalogue',
    category: 'WhatsApp',
    description: 'Send WhatsApp catalogue',
    content: "🛍️ HERE'S OUR CATALOGUE! 🛍️\n\nHi [Customer Name]!\n\nBrowse our full product range:\n[Catalog Link]\n\nOr tell us what you're looking for and we'll help you find it!"
  },
  {
    id: 'wa_order',
    name: 'WhatsApp Order',
    category: 'WhatsApp',
    description: 'Order via WhatsApp',
    content: "📦 READY TO ORDER? 📦\n\nHi [Customer Name]!\n\nYou can order directly via WhatsApp!\n\n1️⃣ Browse catalogue\n2️⃣ Send us your order list\n3️⃣ Confirm and pay\n4️⃣ We deliver!\n\nWhat would you like to order?"
  },
  {
    id: 'wa_tracking',
    name: 'WhatsApp Tracking',
    category: 'WhatsApp',
    description: 'Order tracking via WhatsApp',
    content: "📦 ORDER TRACKING 📦\n\nHi [Customer Name]!\n\nTrack your order status:\n\nOrder: #[Order Number]\nStatus: [Status]\nEstimated: [Date]\n\nTracking link: [Link]"
  }
];

const CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: Sparkles },
  { id: 'Promotions', name: 'Promotions', icon: Megaphone },
  { id: 'Special Offers', name: 'Special Offers', icon: Gift },
  { id: 'Announcements', name: 'Announcements', icon: TrendingUp },
  { id: 'Reminders', name: 'Reminders', icon: Clock },
  { id: 'General', name: 'General', icon: MessageSquare },
  { id: 'Urgent', name: 'Urgent', icon: Zap },
  { id: 'Surveys', name: 'Surveys', icon: Target },
  { id: 'Seasonal', name: 'Seasonal', icon: Calendar },
  { id: 'Retention', name: 'Retention', icon: Star },
  { id: 'Bookings', name: 'Bookings', icon: Calendar },
  { id: 'Support', name: 'Support', icon: MessageCircle },
  { id: 'WhatsApp', name: 'WhatsApp', icon: MessageCircle }
];

interface WhatsAppMarketingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
}

const WhatsAppMarketingModal: React.FC<WhatsAppMarketingModalProps> = ({ 
  open, 
  onOpenChange,
  companyName
}) => {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [sendToGroup, setSendToGroup] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'compose'>('templates');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = AI_TEMPLATES.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleApplyTemplate = (template: Template) => {
    let content = template.content
      .replace(/\[Company Name\]/g, companyName || 'Prime ERP')
      .replace(/\[Customer Name\]/g, 'Valued Customer');
    setMessage(content);
    setSelectedTemplate(template.id);
  };

  const handleSend = () => {
    if (!message.trim()) return;

    let url = '';
    if (sendToGroup) {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    } else {
      const cleanPhone = recipient.replace(/[^0-9]/g, '');
      if (!cleanPhone) {
        alert('Please enter a valid phone number for direct messaging.');
        return;
      }
      url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - Match Add Item Modal pattern */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">WhatsApp Marketing</h2>
              <p className="text-xs text-slate-500">Send promotions and messages to customers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={!message.trim() || (!sendToGroup && !recipient.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Launch WhatsApp
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Tab Navigation - Match Add Item Modal pattern */}
        <div className="flex gap-1 mx-6 mt-4 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'templates' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles size={16} />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('compose')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'compose' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MessageSquare size={16} />
            Compose
          </button>
        </div>

        {/* Content Area */}
        <div className="flex border-t border-slate-200 flex-1 overflow-hidden">
          {/* Sidebar - Category Filter */}
          <div className="w-56 bg-slate-50 border-r border-slate-200 py-4 overflow-y-auto">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-green-50 text-green-600 border-r-2 border-green-600'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <category.icon className="w-4 h-4" />
                {category.name}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'templates' && (
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                  <Sparkles className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                </div>

                {/* Template Count */}
                <p className="text-xs text-slate-500">
                  {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
                </p>

                {/* Templates Grid */}
                <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleApplyTemplate(template)}
                      className={`text-left p-4 rounded-xl border transition-all duration-200 group ${
                        selectedTemplate === template.id 
                          ? 'bg-green-50 border-green-200 shadow-sm' 
                          : 'bg-white border-slate-200 hover:border-green-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className={`text-sm font-semibold ${selectedTemplate === template.id ? 'text-green-700' : 'text-slate-700'}`}>
                            {template.name}
                          </span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                            {template.category}
                          </span>
                        </div>
                        {selectedTemplate === template.id && (
                          <Check size={16} className="text-green-600" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    </button>
                  ))}
                </div>
                
                {/* Pro Tip */}
                <div className="mt-4 p-4 rounded-xl bg-green-50/50 border border-green-100/50">
                  <p className="text-[11px] text-green-600/70 uppercase font-bold tracking-widest flex items-center gap-2">
                    <Sparkles size={10} /> Quick Tip
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Use placeholders like [Customer Name], [Order Number] to personalize your messages.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'compose' && (
              <div className="space-y-5">
                {/* Recipient Type */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
                  <button
                    onClick={() => setSendToGroup(false)}
                    className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                      !sendToGroup ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <MessageCircle size={16} /> Direct
                  </button>
                  <button
                    onClick={() => setSendToGroup(true)}
                    className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                      sendToGroup ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Users size={16} /> Group/Anyone
                  </button>
                </div>

                {!sendToGroup && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +265 888 123 456"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-slate-700"
                    />
                  </div>
                )}

                {sendToGroup && (
                  <div className="p-4 rounded-lg bg-orange-50 border border-orange-100">
                    <p className="text-xs text-orange-700 font-medium">
                      Selecting "Group/Anyone" will open WhatsApp and let you select from your contacts or groups to send the message.
                    </p>
                  </div>
                )}

                {/* Message Editor */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Message Content
                  </label>
                  <textarea
                    rows={10}
                    placeholder="Write your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all resize-none text-slate-700 leading-relaxed font-mono text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1 text-right">
                    {message.length} characters
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppMarketingModal;