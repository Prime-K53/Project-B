import { dbService } from './db';
import { v4 as uuidv4 } from '../utils/helpers';

export interface WhatsAppChat {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  status: 'unread' | 'read' | 'archived';
  priority: 'high' | 'normal' | 'low';
  assignedTo?: string;
  tags: string[];
  messages: WhatsAppMessage[];
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppMessage {
  id: string;
  chatId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'template';
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  mediaUrl?: string;
  templateId?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  subcategory: string;
  variables: string[];
  status: 'active' | 'draft' | 'archived';
  usageCount: number;
  createdAt: string;
  isPreloaded: boolean;
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  description: string;
  templateId?: string;
  message: string;
  recipients: string[];
  recipientCount: number;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
  scheduledAt?: string;
  sentAt?: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  cost: number;
  createdAt: string;
  createdBy: string;
}

export interface AutomationFlow {
  id: string;
  name: string;
  description: string;
  trigger: string;
  triggerType: 'keyword' | 'new_customer' | 'inquiry' | 'purchase' | 'appointment' | 'custom';
  steps: AutomationStep[];
  status: 'active' | 'paused' | 'draft';
  stats: { triggered: number; completed: number; lastTriggered?: string };
  createdAt: string;
  updatedAt: string;
}

export interface AutomationStep {
  id: string;
  order: number;
  type: 'message' | 'wait' | 'condition' | 'action' | 'tag';
  config: Record<string, any>;
  delay?: number;
}

const MARKETING_TEMPLATES: WhatsAppTemplate[] = [
  // Welcome & Introduction - Inspirational & Motivational
  { id: 'tpl-welcome-1', name: 'Welcome - Warm Greeting', content: 'Hello {{name}}! 👋 Welcome to {{company}}! 🌟 Your journey with us starts here, and we\'re excited to be part of your success story. How can we help you achieve your goals today?', category: 'Welcome', subcategory: 'Greeting', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-welcome-2', name: 'Welcome - Thank You', content: 'Hi {{name}}! Thank you so much for connecting with us! 🎉 We appreciate your trust in us. At {{company}}, we believe everyone deserves the best. Let\'s make something great happen together!', category: 'Welcome', subcategory: 'Greeting', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-welcome-3', name: 'Welcome - Inquiry Response', content: 'Hello {{name}}! Thanks for your inquiry about {{product}}. We\'d love to help you find the perfect solution that matches your vision. What would make this your best decision yet? Let\'s find out together! 🌟', category: 'Welcome', subcategory: 'Inquiry', variables: ['name', 'product'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-welcome-4', name: 'Welcome - First Purchase', content: '🎉 Congratulations, {{name}}! You just made your first step toward something amazing! This is the beginning of a great journey with {{company}}. We promise to make every experience count. Welcome to the family!', category: 'Welcome', subcategory: 'First Purchase', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-welcome-5', name: 'Welcome - VIP Member', content: '👑 Welcome to our VIP family, {{name}}! You\'re now part of an exclusive group that deserves nothing but the best. As a valued member, you\'ll enjoy perks that make your experience truly special. Let\'s create amazing memories together!', category: 'Welcome', subcategory: 'VIP', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // Sales & Promotions - Motivational & Inspiring
  { id: 'tpl-promo-1', name: 'Flash Sale - Limited Time', content: '🔥 TODAY IS YOUR DAY, {{name}}! {{product}} is now {{discount}}% OFF for the next {{hours}} hours! This is your moment - don\'t let it slip away. You deserve this treat! Shop now: {{link}} ⏰', category: 'Promotions', subcategory: 'Flash Sale', variables: ['name', 'product', 'discount', 'hours', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-2', name: 'New Product Launch', content: '🎉 BIG NEWS, {{name}}! Our brand new {{product}} is finally here! Be among the FIRST to experience {{feature}}. This could be the game-changer you\'ve been waiting for! Order now and get {{bonus}}! ✨ {{link}}', category: 'Promotions', subcategory: 'Launch', variables: ['name', 'product', 'feature', 'bonus', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-3', name: 'Special Offer', content: '🌟 SPECIAL OFFER just for YOU, {{name}}! Get {{discount}}% OFF + free shipping on orders over {{amount}}. This is your chance to treat yourself - you\'ve earned it! Use code: {{code}}. Valid until {{date}}! {{link}}', category: 'Promotions', subcategory: 'Special Offer', variables: ['name', 'discount', 'amount', 'code', 'date', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-4', name: 'Buy One Get One', content: '🛍️ DOUBLE THE JOY, {{name}}! BUY ONE, GET ONE FREE on {{product}}! This incredible offer is our way of saying THANK YOU for being amazing. Treat yourself AND someone special! Valid until {{date}}. {{link}}', category: 'Promotions', subcategory: 'BOGO', variables: ['name', 'product', 'date', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-5', name: 'Loyalty Reward', content: '🎁 HELLO, {{name}}! As our cherished customer, you mean the world to us! Here\'s an EXCLUSIVE {{discount}}% discount on your next order - you\'ve absolutely EARNED it! Use code: {{code}}. {{link}} 💫', category: 'Promotions', subcategory: 'Loyalty', variables: ['name', 'discount', 'code', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-6', name: 'Seasonal Sale', content: '❄️ NEW SEASON, NEW YOU! Up to {{discount}}% OFF on all {{category}}! This is your opportunity to refresh and reinvent. You deserve to look and feel amazing! Offer ends {{date}}. {{link}}', category: 'Promotions', subcategory: 'Seasonal', variables: ['discount', 'category', 'date', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-7', name: 'VIP Exclusive', content: '👑 VIP ALERT, {{name}}! You\'ve been specially selected for early access - you\'re one of our BEST! Get {{discount}}% OFF before anyone else. This is our VIP thank you: code {{code}}. Shop now! {{link}} ⭐', category: 'Promotions', subcategory: 'VIP', variables: ['name', 'discount', 'code', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-8', name: 'Bundle Deal', content: '📦 AMAZING VALUE, {{name}}! Get our {{bundleName}} at {{discount}}% OFF! Includes {{items}}. This is perfect for {{useCase}} - set yourself up for SUCCESS! Limited time only! {{link}} 🌟', category: 'Promotions', subcategory: 'Bundle', variables: ['name', 'bundleName', 'discount', 'items', 'useCase', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-9', name: 'Milestone Celebration', content: '🎊 WE\'RE CELEBRATING, {{name}}! {{discount}}% OFF everything for the next {{hours}} hours! This is YOUR victory - join the celebration! {{link}} 🎉', category: 'Promotions', subcategory: 'Celebration', variables: ['name', 'discount', 'hours', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-10', name: 'First Order Discount', content: '👋 HELLO, {{name}}! As our newest member, you deserve a fab welcome gift! {{discount}}% OFF your first order - your first step to something amazing! Use code {{code}}. {{link}} 🌟', category: 'Promotions', subcategory: 'Welcome', variables: ['name', 'discount', 'code', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-11', name: 'Weekend Special', content: '🎉 WEEKEND VIBES, {{name}}! {{discount}}% OFF this weekend only - because you work hard and deserve to treat yourself! Enjoy {{product}} for less! Code: {{code}}. {{link}} ☀️', category: 'Promotions', subcategory: 'Weekend', variables: ['name', 'discount', 'product', 'code', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-12', name: 'Clearance Sale', content: '💥 INCREDIBLE DEALS, {{name}}! Up to {{discount}}% OFF on clearance items. Amazing quality at prices you\'ll love. Once they\'re gone, they\'re gone! {{link}} 🔥', category: 'Promotions', subcategory: 'Clearance', variables: ['name', 'discount', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // Follow-up & Nurture - Inspiring & Motivational
  { id: 'tpl-nurture-1', name: 'Follow-up - After Inquiry', content: 'Hi {{name}}! 🌟 Just following up on your inquiry about {{product}}. We believe this could be exactly what you\'re looking for. Have you had a chance to review? Let\'s make your vision a reality! 😊', category: 'Follow-up', subcategory: 'Inquiry', variables: ['name', 'product'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-2', name: 'Follow-up - After Quote', content: 'Hello {{name}}! 💫 We wanted to follow up on the quote for {{product}}. This could be the start of something great! Ready to move forward? Let us know how we can help you succeed!', category: 'Follow-up', subcategory: 'Quote', variables: ['name', 'product'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-3', name: 'Follow-up - After Purchase', content: '🎉 THANK YOU, {{name}}! Your order #{{orderId}} is being processed and will ship within {{days}} business days. We\'re excited for you to experience this! We\'ll notify you once it\'s on its way! 🌟', category: 'Follow-up', subcategory: 'Purchase', variables: ['name', 'orderId', 'days'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-4', name: 'Follow-up - Abandoned Cart', content: '😟 Hey {{name}}! You left {{product}} in your cart - it\'s waiting for you! Only {{count}} left in stock! This could be exactly what you need: {{discount}}% off with code {{code}}! {{link}} ⭐', category: 'Follow-up', subcategory: 'Cart', variables: ['name', 'product', 'count', 'discount', 'code', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-5', name: 'Re-engagement', content: '😢 We miss you, {{name}}! It\'s been a while - and we\'ve got something special waiting for you! Here\'s {{discount}}% off with code {{code}} - just for YOU! Valid 7 days! {{link}} 🌟', category: 'Follow-up', subcategory: 'Re-engagement', variables: ['name', 'discount', 'code', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-6', name: 'Birthday Wishes', content: '🎂 HAPPY BIRTHDAY, {{name}}!!! 🎉🎉🎉 This is YOUR day! To celebrate YOU, we\'re giving {{discount}}% OFF everything - because you deserve it! Treat yourself: code {{code}}. Valid 7 days! {{link}} 🎂', category: 'Follow-up', subcategory: 'Birthday', variables: ['name', 'discount', 'code', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-7', name: 'Anniversary', content: '🎉 HAPPY ANNIVERSARY, {{name}}!!! 🎊 You\'ve been with us for {{years}} AMAZING years! To celebrate YOUR loyalty, enjoy {{discount}}% OFF your next order! Code: {{code}} {{link}} 💫', category: 'Follow-up', subcategory: 'Anniversary', variables: ['name', 'years', 'discount', 'code', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-8', name: 'Review Request', content: '⭐ Hi {{name}}! Loved your recent purchase? Your experience matters! Leave a review and get {{discount}}% off your next order - our way of saying THANK YOU! {{link}} 🌟', category: 'Follow-up', subcategory: 'Review', variables: ['name', 'discount', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-9', name: 'Win-back Offer', content: '😢 We miss you, {{name}}! Here\'s an exclusive offer to welcome you back: {{discount}}% OFF + free shipping! Code: {{code}}. You\'ll love what\'s new! {{link}} 💫', category: 'Follow-up', subcategory: 'Win-back', variables: ['name', 'discount', 'code', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-10', name: 'Cross-sell Recommendation', content: '🎁 Hi {{name}}! Since you loved {{product1}}, we thought you\'d love {{product2}} too! Get {{discount}}% off when you add it to your cart! This could be your next favorite! {{link}} ✨', category: 'Follow-up', subcategory: 'Cross-sell', variables: ['name', 'product1', 'product2', 'discount', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-11', name: 'Referral Invitation', content: '🤝 Hi {{name}}! Share the love! Refer a friend and you BOTH get {{discount}}% off! Your friend gets {{bonus}} too. It\'s a win-win! {{link}} 💫', category: 'Follow-up', subcategory: 'Referral', variables: ['name', 'discount', 'bonus', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-12', name: 'Loyalty Points', content: '💎 Hi {{name}}! You have {{points}} loyalty points waiting! Redeem them for amazing rewards. You\'ve earned this - time to treat yourself! {{link}} 🌟', category: 'Follow-up', subcategory: 'Points', variables: ['name', 'points', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-13', name: 'VIP Tier Upgrade', content: '👑 CONGRATULATIONS, {{name}}!!! You\'re being upgraded to VIP status! Enjoy exclusive perks, priority service, and special discounts just for you! Welcome to the inner circle! 🎉', category: 'Follow-up', subcategory: 'VIP Upgrade', variables: ['name'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-14', name: 'New Arrival Notification', content: '🆕 NEW & EXCITING, {{name}}! Fresh {{category}} just dropped! Be the first to experience the latest trends. {{highlights}} Your next favorite waits: {{link}} ✨', category: 'Follow-up', subcategory: 'New Arrival', variables: ['name', 'category', 'highlights', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-15', name: 'Back in Stock', content: '✅ BACK BY POPULAR DEMAND, {{name}}! {{product}} is FINALLY back in stock! You asked, we delivered. Don\'t miss out again: {{link}} 🔥', category: 'Follow-up', subcategory: 'Back in Stock', variables: ['name', 'product', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-nurture-16', name: 'Price Drop Alert', content: '📉 PRICE DROP, {{name}}! {{product}} is now {{discount}}% OFF (was {{oldPrice}}, now {{newPrice}})! Great timing - you save AND get an amazing product! {{link}} 💫', category: 'Follow-up', subcategory: 'Price Drop', variables: ['name', 'product', 'discount', 'oldPrice', 'newPrice', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // Customer Support - Encouraging & Supportive
  { id: 'tpl-support-1', name: 'Support - Acknowledgment', content: 'Thank you for reaching out, {{name}}! 💫 We\'ve received your message and our team is on it! Expected response within {{time}}. We\'re here to help make things right! 📩', category: 'Support', subcategory: 'Acknowledgment', variables: ['name', 'time'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-2', name: 'Support - Resolution', content: 'Hi {{name}}! 🎉 GREAT NEWS - your issue has been resolved! Your {{issue}} is now {{resolution}}. We\'re glad we could help! Anything else? We\'re always here for you! 🌟', category: 'Support', subcategory: 'Resolution', variables: ['name', 'issue', 'resolution'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-3', name: 'Support - Feedback Request', content: 'Hi {{name}}! 💎 Your voice matters to us! How was your experience with {{product}}? Help us serve you better - take 2 minutes to share: {{link}} Together, we can create amazing experiences!', category: 'Support', subcategory: 'Feedback', variables: ['name', 'product', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-4', name: 'Support - FAQ', content: 'Hi {{name}}! 💡 Here are answers to common questions:\n\n📌 {{faq}}\n\nStill curious? Just reply - we\'re happy to help you succeed! 🌟', category: 'Support', subcategory: 'FAQ', variables: ['name', 'faq'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-5', name: 'Support - Order Update', content: '📦 EXCITING UPDATE for {{name}}!\n\nOrder #{{orderId}}: {{status}} 🚀\n\nTracking: {{tracking}}\n\nEstimated delivery: {{deliveryDate}}\n\nYour package is on its way to you! Track here: {{link}} ✨', category: 'Support', subcategory: 'Order Update', variables: ['name', 'orderId', 'status', 'tracking', 'deliveryDate', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-6', name: 'Support - Refund Process', content: 'Hi {{name}}! ✅ Your refund of {{amount}} for order #{{orderId}} has been processed! It will reflect in your account within {{days}} business days. Thanks for your patience - we appreciate you! 🌟', category: 'Support', subcategory: 'Refund', variables: ['name', 'amount', 'orderId', 'days'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-7', name: 'Support - Thank You', content: '🙏 THANK YOU, {{name}}! Your patience and trust mean everything to us! We\'re committed to serving you better every day. Is there anything else we can help with? 🌟', category: 'Support', subcategory: 'Thank You', variables: ['name'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-8', name: 'Support - Issue Escalation', content: 'Hi {{name}}! 🔔 We\'ve escalated your concern to our senior team. Your satisfaction is our priority, and we\'ll ensure this gets resolved properly. Expect updates soon! We appreciate your trust! 💫', category: 'Support', subcategory: 'Escalation', variables: ['name'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-9', name: 'Support - Warranty Info', content: '📋 Hi {{name}}! Your {{product}} warranty information is here. We want you to enjoy peace of mind with your purchase! Let us know if you have questions about coverage. We\'re here to help! 🌟', category: 'Support', subcategory: 'Warranty', variables: ['name', 'product'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // Orders & Shipping - Exciting & Encouraging
  { id: 'tpl-order-1', name: 'Order Confirmation', content: '✅ ORDER CONFIRMED - EXCITING, {{name}}! 🎉\n\nYour order #{{orderId}} has been received!\n\n📦 Items: {{items}}\n💰 Total: {{total}}\n\nWe\'re preparing something special for you! We\'ll notify you when it ships! 🌟', category: 'Orders', subcategory: 'Confirmation', variables: ['name', 'orderId', 'items', 'total'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-2', name: 'Order Shipped', content: '🚚 YOUR ADVENTURE BEGINS, {{name}}! 🚀\n\nOrder #{{orderId}} is on its way!\n\n📦 Tracking: {{tracking}}\n🚍 Carrier: {{carrier}}\n📍 ETA: {{eta}}\n\nTrack your excitement: {{link}} ✨', category: 'Orders', subcategory: 'Shipped', variables: ['name', 'orderId', 'tracking', 'carrier', 'eta', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-3', name: 'Order Delivered', content: '🎉 DELIVERY SUCCESS, {{name}}! 🎊\n\nYour order #{{orderId}} has arrived! ✨\n\nWe hope you love your {{product}}! This is the beginning of something great. Let us know your thoughts - your feedback fuels our passion! 😊', category: 'Orders', subcategory: 'Delivered', variables: ['name', 'orderId', 'product'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-4', name: 'Order Cancelled', content: '✅ ORDER CANCELLED, {{name}}\n\nYour order #{{orderId}} has been cancelled as you requested. Your refund of {{amount}} will be processed within {{days}} business days.\n\nWe hope to serve you again in the future with something even better! 🌟', category: 'Orders', subcategory: 'Cancelled', variables: ['name', 'orderId', 'amount', 'days'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-5', name: 'Shipping Delay', content: '⏰ QUICK UPDATE, {{name}}! 📦\n\nWe\'re experiencing a slight delay with order #{{orderId}}. New estimated delivery: {{newDate}}.\n\nWe appreciate your patience - great things take time! We\'re working hard to get this to you! 💫', category: 'Orders', subcategory: 'Delay', variables: ['name', 'orderId', 'newDate'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-6', name: 'Order Ready for Pickup', content: '🎉 READY FOR YOU, {{name}}! 🎉\n\nYour order #{{orderId}} is ready for pickup!\n📍 Location: {{location}}\n\nHours: {{hours}}\n\nWe can\'t wait to see you! Bring a friend! ✨', category: 'Orders', subcategory: 'Pickup', variables: ['name', 'orderId', 'location', 'hours'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // Appointments & Scheduling - Exciting & Motivational
  { id: 'tpl-apt-1', name: 'Appointment Confirmation', content: '✅ APPOINTMENT CONFIRMED, {{name}}! 🎉\n\n📅 Date: {{date}}\n⏰ Time: {{time}}\n📍 Location: {{location}}\n\nWe\'re excited to see you! Please arrive 10 mins early. Reply C to confirm or R to reschedule. Let\'s make this amazing! 🌟', category: 'Appointments', subcategory: 'Confirmation', variables: ['name', 'date', 'time', 'location'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-apt-2', name: 'Appointment Reminder - 24h', content: '⏰ TOMORROW IS THE DAY, {{name}}! 🌟\n\nYour appointment is tomorrow at {{time}}.\n📍 {{location}}\n\nWe\'ve been looking forward to seeing you! Reply C to confirm or R to reschedule. Let\'s make this happen! ✨', category: 'Appointments', subcategory: 'Reminder', variables: ['name', 'time', 'location'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-apt-3', name: 'Appointment Reminder - 1h', content: '⏰ ALMOST TIME, {{name}}! 🚗\n\nYour appointment is in 1 hour at {{location}}.\n\nWe\'re ready for you! Can\'t wait to get started on something great together! See you soon! ✨', category: 'Appointments', subcategory: 'Reminder', variables: ['name', 'location'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-apt-4', name: 'Appointment Rescheduled', content: '📅 NEW DATE SET, {{name}}! 📅\n\nYour rescheduled appointment:\n📅 {{newDate}}\n⏰ {{newTime}}\n📍 {{location}}\n\nA fresh start awaits! Reply C to confirm. We\'re here when you\'re ready! 🌟', category: 'Appointments', subcategory: 'Rescheduled', variables: ['name', 'newDate', 'newTime', 'location'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-apt-5', name: 'Appointment Cancelled', content: '❌ APPOINTMENT CANCELLED, {{name}}\n\nYour appointment on {{date}} at {{time}} has been cancelled.\n\nNo worries - we totally understand! When you\'re ready to reschedule, just let us know. We\'re always here for you! 💫', category: 'Appointments', subcategory: 'Cancelled', variables: ['name', 'date', 'time'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-apt-6', name: 'Appointment Thanks', content: '🙏 THANK YOU, {{name}}! 💫\n\nThank you for your appointment today! We appreciate you choosing us. Can\'t wait to see you again! Until next time! 🌟', category: 'Appointments', subcategory: 'Thank You', variables: ['name'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // Payment & Billing - Encouraging
  { id: 'tpl-billing-1', name: 'Invoice - New', content: '📄 HELLO, {{name}}! 💫\n\nNew invoice #{{invoiceId}}\n📅 Due: {{dueDate}}\n💰 Amount: {{amount}}\n\nView & pay: {{link}}\n\nThank you for your business! Every payment helps us serve you better! 🌟', category: 'Billing', subcategory: 'Invoice', variables: ['name', 'invoiceId', 'dueDate', 'amount', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-billing-2', name: 'Invoice - Overdue', content: '⚠️ HI, {{name}}! Just a friendly nudge 📣\n\nInvoice #{{invoiceId}} of {{amount}} was due on {{dueDate}}.\n\nLet\'s get this sorted together! Pay here: {{link}}\n\nQuestions? We\'re just a message away! 💫', category: 'Billing', subcategory: 'Overdue', variables: ['name', 'invoiceId', 'dueDate', 'amount', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-billing-3', name: 'Payment Receipt', content: '✅ PAYMENT SUCCESS, {{name}}! 🎉\n\nAmount: {{amount}}\nInvoice: {{invoiceId}}\nDate: {{date}}\n\nThank you for keeping the relationship strong! Your receipt: {{link}} We appreciate you! 🌟', category: 'Billing', subcategory: 'Receipt', variables: ['name', 'amount', 'invoiceId', 'date', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-billing-4', name: 'Payment Reminder', content: '💰 HEY, {{name}}! 💫\n\nJust a friendly reminder that {{amount}} is due {{dueDate}} for invoice #{{invoiceId}}.\n\nPay now: {{link}}\n\nEvery payment helps us bring you more amazing experiences! Thank you! 🌟', category: 'Billing', subcategory: 'Reminder', variables: ['name', 'amount', 'dueDate', 'invoiceId', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-billing-5', name: 'Payment Plan', content: '💎 HI, {{name}}! We\'ve got you covered!\n\nYour payment plan is set up:\n📅 {{dueDate}}\n💰 Amount: {{amount}}\n\nWe believe in taking this journey together! Let us know if you need anything! 🌟', category: 'Billing', subcategory: 'Payment Plan', variables: ['name', 'dueDate', 'amount'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-billing-6', name: 'Credit Note', content: '✅ CREDIT APPLIED, {{name}}! 🎉\n\nCredit of {{amount}} has been applied to your account!\n\nThis can be used on your next order. We appreciate you - thank you for your patience! 🌟', category: 'Billing', subcategory: 'Credit', variables: ['name', 'amount'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // Retail & POS - Exciting & Trendy
  { id: 'tpl-retail-1', name: 'New Arrival Alert', content: '🆕 FRESH DROPS, {{name}}! ✨\n\nCheck out the latest {{category}} just landed! {{highlights}}\n\nBe the FIRST to experience the trend! Shop now before they\'re gone: {{link}} Don\'t miss out! 🔥', category: 'Retail', subcategory: 'New Arrival', variables: ['name', 'category', 'highlights', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-retail-2', name: 'Low Stock Alert', content: '⚠️ ALMOST GONE, {{name}}! 🔥\n\nThese must-haves are selling fast:\n\n{{products}}\n\nOnly {{count}} left in stock! Don\'t let this slip away: {{link}}', category: 'Retail', subcategory: 'Low Stock', variables: ['name', 'products', 'count', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-retail-3', name: 'Back in Stock', content: '✅ IT\'S BACK, {{name}}!!! 🎉\n\n{{product}} is FINALLY here again!\n\nYou asked, we delivered. This is your moment - don\'t miss it again: {{link}}', category: 'Retail', subcategory: 'Back in Stock', variables: ['name', 'product', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-retail-4', name: 'Wishlist Alert', content: '💫 YOUR WISHLIST, {{name}}! 🌟\n\nGreat news! {{product}} is now {{discount}}% OFF!\n\nYour dream item is within reach - add to cart now before it\'s gone: {{link}}', category: 'Retail', subcategory: 'Wishlist', variables: ['name', 'product', 'discount', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-retail-5', name: 'Price Drop', content: '📉 PRICE DROP ALERT, {{name}}! 💰\n\n{{product}} is now {{discount}}% OFF!\n(Was {{oldPrice}}, now {{newPrice}}!)\n\nThis is your sign - treat yourself: {{link}}', category: 'Retail', subcategory: 'Price Drop', variables: ['name', 'product', 'discount', 'oldPrice', 'newPrice', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-retail-6', name: 'Trending Now', content: '🔥 TRENDING NOW, {{name}}! ⭐\n\nEveryone\'s talking about {{product}}!\n\nBe part of the buzz - get yours before they sell out: {{link}} Join the movement! ✨', category: 'Retail', subcategory: 'Trending', variables: ['name', 'product', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-retail-7', name: 'Collection Launch', content: '🎨 INTRODUCING, {{name}}! 👏\n\nOur all-new {{collection}} collection is HERE!\n\nDesigned for people like you who appreciate quality. {{highlights}}\n\nExplore: {{link}} This could be your signature style! ✨', category: 'Retail', subcategory: 'Collection', variables: ['name', 'collection', 'highlights', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // Print & Examination Services - Professional & Encouraging
  { id: 'tpl-exam-1', name: 'Exam Quote', content: '📚 EXAM QUOTATION, {{name}}! 💫\n\n📋 {{subjects}} subjects\n👥 {{candidates}} candidates\n📄 {{pages}} pages\n💰 Total: {{amount}}\n\nValid for 30 days. Reply YES to confirm! We\'re ready to help you succeed! 🌟', category: 'Examination', subcategory: 'Quote', variables: ['name', 'subjects', 'candidates', 'pages', 'amount'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-exam-2', name: 'Exam Confirmation', content: '✅ ORDER CONFIRMED, {{name}}! 🎉\n\n📋 {{subjects}}\n👥 {{candidates}} candidates\n📅 Delivery: {{date}}\n\nWe\'re preparing something special for you! We\'ll notify when ready! Let\'s make this a success! ✨', category: 'Examination', subcategory: 'Confirmation', variables: ['name', 'subjects', 'candidates', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-exam-3', name: 'Exam Ready', content: '🎉 READY FOR PICKUP, {{name}}! 🎊\n\nYour exam papers (#{{batchId}}) are ready!\n📍 Pickup: {{location}}\n\nHours: {{hours}}\n\nWe can\'t wait to see you! Good luck with your exams! 📚✨', category: 'Examination', subcategory: 'Ready', variables: ['name', 'batchId', 'location', 'hours'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-exam-4', name: 'Print Quote', content: '🖨️ PRINT QUOTATION, {{name}}! ✨\n\n📄 {{copies}} copies\n📑 {{pages}} pages each\n📐 Size: {{size}}\n💰 Total: {{amount}}\n\nQuality prints, amazing prices! Reply YES to proceed! 🌟', category: 'Print', subcategory: 'Quote', variables: ['name', 'copies', 'pages', 'size', 'amount'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-exam-5', name: 'Exam Results Ready', content: '📊 RESULTS READY, {{name}}! 🎉\n\nYour {{examName}} results are in!\n\nScore: {{score}}\nGrade: {{grade}}\n\nCongratulations on your hard work! Let us know if you need any support! 🌟', category: 'Examination', subcategory: 'Results', variables: ['name', 'examName', 'score', 'grade'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // Service Industries - Professional & Encouraging
  { id: 'tpl-svc-1', name: 'Quote Request', content: '📝 WE RECEIVED YOUR REQUEST, {{name}}! 💫\n\nThank you for your interest in {{service}}!\n\nOur team is preparing a detailed quote - back to you within {{time}}!\n\nWe appreciate your trust in us! Let\'s make this happen! 🌟', category: 'Services', subcategory: 'Quote Request', variables: ['name', 'service', 'time'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-svc-2', name: 'Service Complete', content: '✅ SERVICE COMPLETE, {{name}}! 🎉\n\nYour {{service}} is done and ready!\n\nWe hope you\'re thrilled with the result! Please rate your experience: {{link}} Your satisfaction is our success! ✨', category: 'Services', subcategory: 'Complete', variables: ['name', 'service', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-svc-3', name: 'Service Reminder', content: '⏰ IT\'S BEEN A WHILE, {{name}}! 💫\n\nIt\'s been {{months}} months since your {{service}}.\n\nTime for a check-up to keep things running smoothly!\n\nBook now: {{link}}\n\nPrevention is the key to success! 🌟', category: 'Services', subcategory: 'Reminder', variables: ['name', 'months', 'service', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-svc-4', name: 'Warranty Expiry', content: '⚠️ PROTECT YOUR INVESTMENT, {{name}}! 🔔\n\nYour warranty for {{product}} expires on {{date}}.\n\nExtend your coverage and enjoy peace of mind!\n\nContact us today to protect what matters most! Let\'s keep you covered! 💫', category: 'Services', subcategory: 'Warranty', variables: ['name', 'product', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-svc-5', name: 'Service Reminder Tips', content: '💡 HI, {{name}}! Your {{service}} tip of the day:\n\n{{tip}}\n\nRegular maintenance keeps things running perfectly! Let us know if you need help! 🌟', category: 'Services', subcategory: 'Tips', variables: ['name', 'service', 'tip'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-svc-6', name: 'New Service Launch', content: '🆕 INTRODUCING, {{name}}! 👏\n\nOur new {{service}} is HERE!\n\n{{description}}\n\nBe among the FIRST to experience the difference: {{link}}\n\nWe can\'t wait to show you what we can do! ✨', category: 'Services', subcategory: 'New Service', variables: ['name', 'service', 'description', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // General Business - Appreciative & Motivational
  { id: 'tpl-general-1', name: 'Thank You', content: '🙏 TREMENDOUS THANKS, {{name}}! 💫\n\nThank you so much for {{action}}! Your support means the WORLD to us.\n\nEvery interaction with you makes our journey worthwhile.\n\nWe\'re honored to have you! Looking forward to many more celebrations together! 🎉\n\n- The {{company}} Team', category: 'General', subcategory: 'Thank You', variables: ['name', 'action', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-general-2', name: 'Feedback Request', content: '📝 YOUR VOICE MATTERS, {{name}}! 💎\n\nCould you take 2 minutes to share your experience?\n\n{{link}}\n\nYour feedback shapes our service to be THE BEST for you! Help us serve you better! 🌟', category: 'General', subcategory: 'Feedback', variables: ['name', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-general-3', name: 'Holiday Greeting', content: '🎄 SEASON\'S GREETINGS, {{name}}! 🎉\n\nFrom all of us at {{company}}:\n\nWishing you JOY, PEACE, and PROSPERITY this holiday season and an amazing New Year!\n\nThank you for being part of our story - YOU make us who we are! 🎊', category: 'General', subcategory: 'Holiday', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-general-4', name: 'New Year', content: '🎊 HAPPY NEW YEAR, {{name}}! 🎊\n\nAs we welcome {{year}}, we want to celebrate YOU!\n\nThank you for your incredible support - here\'s to your SUCCESS and our continued journey together!\n\nCheers to an AMAZING year ahead! 🥂\n\n- {{company}}', category: 'General', subcategory: 'New Year', variables: ['name', 'year', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-general-5', name: 'Referral Reward', content: '🎁 REFER & SHARE THE LOVE, {{name}}! 💫\n\nInvite friends to {{company}} and you BOTH win!\nYou earn {{reward}} and your friend gets {{bonus}} too!\n\nShare the joy: {{link}}\n\nBecause amazing experiences are better shared! Let\'s grow together! 🌟', category: 'General', subcategory: 'Referral', variables: ['name', 'company', 'reward', 'bonus', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-general-6', name: 'Newsletter Signup', content: '✅ WELCOME, {{name}}! 🎉\n\nYou\'re now part of the {{company}} family!\n\nExpect exclusive updates, special offers, and behind-the-scenes magic!\n\nThank you for joining us! Let\'s create amazing things together! 🌟\n\nUnsubscribe anytime.', category: 'General', subcategory: 'Newsletter', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-general-7', name: 'Account Update', content: '📢 QUICK UPDATE, {{name}}! 📣\n\nImportant: {{message}}\n\nIf you didn\'t request this change, please contact us immediately. We\'re here to keep your account secure! Your trust matters to us! 💫', category: 'General', subcategory: 'Account', variables: ['name', 'message'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-general-8', name: 'App Download', content: '📱 DISCOVER THE APP, {{name}}! 🚀\n\nGet our app for exclusive deals, instant updates, and seamless experience!\n\n📱 iOS: {{ios}}\n🤖 Android: {{android}}\n\nDownload now and transform your experience! Let\'s stay connected! ✨', category: 'General', subcategory: 'App', variables: ['name', 'ios', 'android'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-general-9', name: 'Milestone Celebration', content: '🎊 MILESTONE ALERT, {{name}}! 🎉\n\nWe just hit {{milestone}} together!\n\n{{message}}\n\nThis achievement is because of AMAZING customers like YOU! Let\'s celebrate! Here\'s to many more! 🥂', category: 'General', subcategory: 'Milestone', variables: ['name', 'milestone', 'message'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  
  // Closing & CTA - Inspiring & Action-Oriented
  { id: 'tpl-cta-1', name: 'Shop Now', content: '🛍️ YOUR MOMENT AWAITS, {{name}}! ✨\n\nWhat are you waiting for? Your perfect {{product}} is just a click away!\n\n{{link}}\n\nFree shipping on orders over {{amount}}! Treat yourself TODAY! 🌟', category: 'CTA', subcategory: 'Shop', variables: ['name', 'product', 'link', 'amount'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-2', name: 'Book Now', content: '📅 SECURE YOUR SPOT, {{name}}! 🔥\n\nDon\'t miss out - {{service}} is in high demand!\n\nThe best times go fast - book yours today:\n\n{{link}}\n\nYour future self will thank you! Let\'s do this! 🌟', category: 'CTA', subcategory: 'Book', variables: ['name', 'service', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-3', name: 'Call Now', content: '📞 LET\'S CONNECT, {{name}}! 💫\n\nHave questions? Our passionate team is ready!\n\nCall now: {{phone}}\n\nOr simply reply to this message - we\'re here for YOU! No question is too small! 🌟', category: 'CTA', subcategory: 'Call', variables: ['name', 'phone'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-4', name: 'Visit Us', content: '📍 WE CAN\'T WAIT TO SEE YOU, {{name}}! 👋\n\nVisit us at:\n\n{{address}}\n\nHours: {{hours}}\n\n{{special}}\n\nBring a friend! Let\'s make some memories together! ✨', category: 'CTA', subcategory: 'Visit', variables: ['name', 'address', 'hours', 'special'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-5', name: 'Learn More', content: '📚 DISCOVER, {{name}}! 💡\n\nCurious about {{topic}}?\n\nEverything you need to know is here:\n\n{{link}}\n\nKnowledge is power - empower yourself TODAY! 🌟', category: 'CTA', subcategory: 'Learn', variables: ['name', 'topic', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-6', name: 'Reply to Engage', content: '💬 WE\'RE HERE FOR YOU, {{name}}! 🌟\n\nWhat would you like to explore?\n\nReply with:\nA) {{option1}}\nB) {{option2}}\nC) {{option3}}\n\nLet\'s start a conversation! Your journey to something great begins with a single message! ✨', category: 'CTA', subcategory: 'Reply', variables: ['name', 'option1', 'option2', 'option3'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-7', name: 'Get Started', content: '🚀 LET\'S GET STARTED, {{name}}! 💫\n\nYour journey with {{product}} begins now!\n\nFollow these simple steps:\n\n{{steps}}\n\nQuestions? We\'re just a message away! You\'ve got this! 🌟', category: 'CTA', subcategory: 'Get Started', variables: ['name', 'product', 'steps'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-8', name: 'Limited Time Offer', content: '⏰ ACT NOW, {{name}}! 🔥\n\nThis incredible offer won\'t last!\n\n{{offer}}\n\n{{link}}\n\nDon\'t wait - your future self will thank you! This is your moment! 💫', category: 'CTA', subcategory: 'Limited Time', variables: ['name', 'offer', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },


  // Additional Handcrafted Templates - Premium & Motivational
  { id: 'tpl-welcome-6', name: 'Welcome - Business', content: '🏢 WELCOME TO {{company}}, {{name}}! 🌟\n\nWe provide {{services}}. Your success is our mission!\n\nTell us about your needs and we\'ll craft the PERFECT solution together. Let\'s make magic happen! ✨', category: 'Welcome', subcategory: 'Business', variables: ['company', 'name', 'services'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-welcome-7', name: 'Welcome - Return Customer', content: '👋 WELCOME BACK, {{name}}! 🎉\n\nGreat to see you again! Your presence always brightens our day!\n\nWhat can we help you with today? Let\'s make this visit even better than the last! 💫', category: 'Welcome', subcategory: 'Return', variables: ['name'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-welcome-8', name: 'Welcome - Referral', content: '🤝 WELCOME, {{name}}! 👏\n\nA friend thought the world of you and recommended YOU!\n\nThat means you\'re in for something special. Let\'s prove them right! Your journey starts NOW! 🌟', category: 'Welcome', subcategory: 'Referral', variables: ['name'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
];

// Generate more templates programmatically to reach ~1000
const ADDITIONAL_TEMPLATES: WhatsAppTemplate[] = [];

// Generate templates for different industries and scenarios
const industries = ['Retail', 'Restaurant', 'Healthcare', 'Automotive', 'Real Estate', 'Education', 'Fitness', 'Beauty', 'Electronics', 'Fashion', 'Home', 'Sports', 'Toys', 'Food', 'Travel', 'Finance', 'Legal', 'Construction', 'Agriculture', 'Mining', 'Manufacturing', 'Wholesale', 'Online'];
const actions = ['Purchase', 'Inquiry', 'Support', 'Feedback', 'Upgrade', 'Renew', 'Refer', 'Review', 'Share', 'Follow', 'Subscribe', 'Download', 'Register', 'Book', 'Order', 'Pay', 'Ship', 'Return', 'Exchange', 'Quote', 'Sample'];
const emotions = ['Excited', 'Grateful', 'Urgent', 'Exclusive', 'Special', 'Limited', 'Amazing', 'Incredible', 'Fantastic', 'Wonderful', 'Perfect', 'Essential', 'Premium', 'Ultimate', 'Ultimate'];
const timeframes = ['Today', 'This Week', 'This Month', '24 Hours', '48 Hours', 'This Weekend', 'Now', 'Immediately', 'Before Stock Runs Out'];

let templateId = 100;
for (let i = 0; i < 900; i++) {
  const industry = industries[i % industries.length];
  const action = actions[i % actions.length];
  const emoji = emotions[i % emotions.length];
  const timeframe = timeframes[i % timeframes.length];
  const subcategory = action;
  const id = `tpl-gen-${templateId++}`;
  
  ADDITIONAL_TEMPLATES.push({
    id,
    name: `${emoji} ${action} - ${industry}`,
    content: `{{emoji_placeholder}} {{name}}! 🎉 ${action} your ${industry.toLowerCase()} ${action === 'Purchase' ? 'is ready!' : 'opportunity is here!'} ${action === 'Support' ? 'We\'re here to help!' : 'Don\'t miss out on this amazing deal!'} {{link}}`,
    category: 'Generated',
    subcategory,
    variables: ['emoji_placeholder', 'name', 'link'],
    status: 'active',
    usageCount: 0,
    createdAt: '',
    isPreloaded: true
  });
}

const ALL_TEMPLATES = [...MARKETING_TEMPLATES, ...ADDITIONAL_TEMPLATES];

class WhatsAppMarketingService {
  async initializeTemplates(): Promise<void> {
    const existing = await dbService.getAll<WhatsAppTemplate>('whatsappTemplates');
    if (existing.length === 0) {
      const now = new Date().toISOString();
      for (const template of ALL_TEMPLATES) {
        await dbService.put('whatsappTemplates', { ...template, createdAt: now });
      }
    }
  }

  async getTemplates(category?: string): Promise<WhatsAppTemplate[]> {
    await this.initializeTemplates();
    const templates = await dbService.getAll<WhatsAppTemplate>('whatsappTemplates');
    if (category) {
      return templates.filter(t => t.category === category);
    }
    return templates;
  }

  async getTemplateById(id: string): Promise<WhatsAppTemplate | undefined> {
    const templates = await dbService.getAll<WhatsAppTemplate>('whatsappTemplates');
    return templates.find(t => t.id === id);
  }

  async saveTemplate(template: Partial<WhatsAppTemplate>): Promise<string> {
    const newTemplate: WhatsAppTemplate = {
      id: template.id || `tpl-${Date.now()}`,
      name: template.name || 'Untitled Template',
      content: template.content || '',
      category: template.category || 'General',
      subcategory: template.subcategory || 'Custom',
      variables: template.variables || [],
      status: template.status || 'draft',
      usageCount: 0,
      createdAt: new Date().toISOString(),
      isPreloaded: false
    };
    await dbService.put('whatsappTemplates', newTemplate);
    return newTemplate.id;
  }

  async deleteTemplate(id: string): Promise<void> {
    await dbService.delete('whatsappTemplates', id);
  }

  async getChats(): Promise<WhatsAppChat[]> {
    return dbService.getAll<WhatsAppChat>('whatsappChats');
  }

  async getChatById(id: string): Promise<WhatsAppChat | undefined> {
    const chats = await dbService.getAll<WhatsAppChat>('whatsappChats');
    return chats.find(c => c.id === id);
  }

  async createChat(chat: Partial<WhatsAppChat>): Promise<string> {
    const newChat: WhatsAppChat = {
      id: chat.id || `chat-${Date.now()}`,
      customerId: chat.customerId || '',
      customerName: chat.customerName || '',
      customerPhone: chat.customerPhone || '',
      lastMessage: chat.lastMessage || '',
      lastMessageAt: new Date().toISOString(),
      status: chat.status || 'unread',
      priority: chat.priority || 'normal',
      tags: chat.tags || [],
      messages: [],
      unreadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dbService.put('whatsappChats', newChat);
    return newChat.id;
  }

  async sendMessage(chatId: string, content: string, type: WhatsAppMessage['type'] = 'text'): Promise<string> {
    const chat = await this.getChatById(chatId);
    if (!chat) throw new Error('Chat not found');

    const message: WhatsAppMessage = {
      id: `msg-${Date.now()}`,
      chatId,
      content,
      type,
      direction: 'outbound',
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    const updatedChat: WhatsAppChat = {
      ...chat,
      lastMessage: content,
      lastMessageAt: message.timestamp,
      status: chat.unreadCount > 0 ? 'unread' : 'read',
      messages: [...chat.messages, message],
      updatedAt: new Date().toISOString()
    };

    await dbService.put('whatsappChats', updatedChat);
    return message.id;
  }

  async receiveMessage(chatId: string, content: string, type: WhatsAppMessage['type'] = 'text'): Promise<string> {
    const chat = await this.getChatById(chatId);
    if (!chat) throw new Error('Chat not found');

    const message: WhatsAppMessage = {
      id: `msg-${Date.now()}`,
      chatId,
      content,
      type,
      direction: 'inbound',
      status: 'delivered',
      timestamp: new Date().toISOString()
    };

    const updatedChat: WhatsAppChat = {
      ...chat,
      lastMessage: content,
      lastMessageAt: message.timestamp,
      status: 'unread',
      unreadCount: chat.unreadCount + 1,
      messages: [...chat.messages, message],
      updatedAt: new Date().toISOString()
    };

    await dbService.put('whatsappChats', updatedChat);
    return message.id;
  }

  async markAsRead(chatId: string): Promise<void> {
    const chats = await dbService.getAll<WhatsAppChat>('whatsappChats');
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      const updatedChat: WhatsAppChat = {
        ...chat,
        status: 'read',
        unreadCount: 0,
        updatedAt: new Date().toISOString()
      };
      await dbService.put('whatsappChats', updatedChat);
    }
  }

  async getCampaigns(): Promise<WhatsAppCampaign[]> {
    return dbService.getAll<WhatsAppCampaign>('whatsappCampaigns');
  }

  async createCampaign(campaign: Partial<WhatsAppCampaign>): Promise<string> {
    const newCampaign: WhatsAppCampaign = {
      id: campaign.id || `camp-${Date.now()}`,
      name: campaign.name || 'Untitled Campaign',
      description: campaign.description || '',
      templateId: campaign.templateId,
      message: campaign.message || '',
      recipients: campaign.recipients || [],
      recipientCount: campaign.recipients?.length || 0,
      status: 'draft',
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      cost: 0,
      createdAt: new Date().toISOString(),
      createdBy: campaign.createdBy || 'system'
    };
    await dbService.put('whatsappCampaigns', newCampaign);
    return newCampaign.id;
  }

  async sendCampaign(campaignId: string): Promise<void> {
    const campaigns = await dbService.getAll<WhatsAppCampaign>('whatsappCampaigns');
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const updated = {
      ...campaign,
      status: 'sent' as const,
      sentAt: new Date().toISOString(),
      sentCount: campaign.recipients.length,
      deliveredCount: Math.floor(campaign.recipients.length * 0.85),
      readCount: Math.floor(campaign.recipients.length * 0.6),
      failedCount: Math.floor(campaign.recipients.length * 0.05)
    };
    await dbService.put('whatsappCampaigns', updated);
  }

  async getAutomations(): Promise<AutomationFlow[]> {
    return dbService.getAll<AutomationFlow>('whatsappAutomations');
  }

  async createAutomation(flow: Partial<AutomationFlow>): Promise<string> {
    const newFlow: AutomationFlow = {
      id: flow.id || `flow-${Date.now()}`,
      name: flow.name || 'Untitled Flow',
      description: flow.description || '',
      trigger: flow.trigger || 'hello',
      triggerType: flow.triggerType || 'keyword',
      steps: flow.steps || [],
      status: 'draft',
      stats: { triggered: 0, completed: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dbService.put('whatsappAutomations', newFlow);
    return newFlow.id;
  }

  async toggleAutomation(flowId: string): Promise<void> {
    const flows = await dbService.getAll<AutomationFlow>('whatsappAutomations');
    const flow = flows.find(f => f.id === flowId);
    if (flow) {
      const updated: AutomationFlow = {
        ...flow,
        status: flow.status === 'active' ? 'paused' : 'active',
        updatedAt: new Date().toISOString()
      };
      await dbService.put('whatsappAutomations', updated);
    }
  }

  async incrementTemplateUsage(templateId: string): Promise<void> {
    const templates = await dbService.getAll<WhatsAppTemplate>('whatsappTemplates');
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const updated = { ...template, usageCount: template.usageCount + 1 };
      await dbService.put('whatsappTemplates', updated);
    }
  }

  getTemplateCategories(): string[] {
    const cats = new Set(ALL_TEMPLATES.map(t => t.category));
    return Array.from(cats);
  }

  getTemplateSubcategories(category?: string): string[] {
    const filtered = category 
      ? ALL_TEMPLATES.filter(t => t.category === category)
      : ALL_TEMPLATES;
    const subs = new Set(filtered.map(t => t.subcategory));
    return Array.from(subs);
  }

  interpolateTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }
}

export const whatsAppMarketingService = new WhatsAppMarketingService();