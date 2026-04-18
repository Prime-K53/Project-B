import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Send, Users, Clock, CheckCircle, XCircle, Plus, Search, Filter,
  ArrowLeft, Archive, Star, Trash2, Download, Settings, Zap, Tag, MessageSquare,
  BarChart3, UserPlus, Volume2, Calendar, Repeat, ChevronRight, PhoneCall, Bot, GitBranch, 
  Play, Pause, Save, Copy, ExternalLink, Link, FileText, Image, Video, Phone, Check,
  CheckCheck, MoreVertical, Smile, MapPin, Mic, QrCode, GripVertical, X, RefreshCw,
  AlertCircle, TrendingUp, DollarSign, Package, Ticket, FileCheck, Truck, CreditCard
} from 'lucide-react';
import { dbService } from '../../services/db';
import { useData } from '../../context/DataContext';
import { whatsAppMarketingService, WhatsAppTemplate, WhatsAppCampaign, AutomationFlow, WhatsAppChat } from '../../services/whatsAppMarketingService';

interface CampaignFormData {
  name: string;
  description: string;
  templateId: string;
  message: string;
  recipients: string[];
  scheduledAt: string;
}

const MarketingMessages: React.FC = () => {
  const { notify, companyConfig, customers } = useData();
  const currency = companyConfig?.currencySymbol || 'K';
  
  const [activeView, setActiveView] = useState<'inbox' | 'campaigns' | 'templates' | 'automation' | 'settings'>('inbox');
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [automations, setAutomations] = useState<AutomationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showNewAutomation, setShowNewAutomation] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState<WhatsAppTemplate | null>(null);
  const [showCampaignPreview, setShowCampaignPreview] = useState(false);
  const [showTemplatePreviewModal, setShowTemplatePreviewModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const replaceVars = (text: string): string => {
    return text.split('{{name}}').join('Customer Name')
      .split('{{company}}').join(companyConfig?.companyName || 'Your Company')
      .split('{{product}}').join('Product Name')
      .split('{{discount}}').join('20')
      .split('{{link}}').join('https://example.com')
      .split('{{code}}').join('SAVE20')
      .split('{{amount}}').join('$100')
      .split('{{orderId}}').join('ORD-12345')
      .split('{{tracking}}').join('TRACK123')
      .split('{{location}}').join('Our Store')
      .split('{{time}}').join('10:00 AM')
      .split('{{date}}').join('April 18, 2026');
  };

  // Form states
  const [campaignForm, setCampaignForm] = useState<CampaignFormData>({
    name: '',
    description: '',
    templateId: '',
    message: '',
    recipients: [],
    scheduledAt: ''
  });
  const [recipientInput, setRecipientInput] = useState('');
  const [templateCategory, setTemplateCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'alpha'>('newest');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedChat && messagesEndRef.current) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [selectedChat?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await whatsAppMarketingService.initializeTemplates();
      const [chatsData, templatesData, campaignsData, automationsData] = await Promise.all([
        whatsAppMarketingService.getChats(),
        whatsAppMarketingService.getTemplates(),
        whatsAppMarketingService.getCampaigns(),
        whatsAppMarketingService.getAutomations()
      ]);
      setChats(chatsData);
      setTemplates(templatesData);
      setCampaigns(campaignsData);
      setAutomations(automationsData);
    } catch (error) {
      console.error('Error loading marketing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    await whatsAppMarketingService.sendMessage(selectedChat.id, newMessage);
    
    const updatedChats = await whatsAppMarketingService.getChats();
    setChats(updatedChats);
    const updated = updatedChats.find(c => c.id === selectedChat.id);
    if (updated) setSelectedChat(updated);
    setNewMessage('');
    notify('Message sent successfully', 'success');
  }, [newMessage, selectedChat, notify]);

  const quickReply = useCallback(async (template: WhatsAppTemplate) => {
    if (!selectedChat) return;
    
    let message = template.content;
    message = message.replace(/{{name}}/g, selectedChat.customerName || 'Customer');
    message = message.replace(/{{company}}/g, companyConfig?.companyName || 'Our Company');
    
    await whatsAppMarketingService.sendMessage(selectedChat.id, message);
    await whatsAppMarketingService.incrementTemplateUsage(template.id);
    
    const updatedChats = await whatsAppMarketingService.getChats();
    setChats(updatedChats);
    const updated = updatedChats.find(c => c.id === selectedChat.id);
    if (updated) setSelectedChat(updated);
    setShowTemplatePreview(null);
    notify('Quick reply sent!', 'success');
  }, [selectedChat, companyConfig?.companyName, notify]);

  const handlePreviewCampaign = () => {
    if (!campaignForm.message.trim()) {
      notify('Please enter a message to preview', 'error');
      return;
    }
    setShowCampaignPreview(true);
  };

  const handleCreateCampaign = async () => {
    if (!campaignForm.name || !campaignForm.message) {
      notify('Please fill in campaign name and message', 'error');
      return;
    }

    await whatsAppMarketingService.createCampaign({
      name: campaignForm.name,
      description: campaignForm.description,
      templateId: campaignForm.templateId,
      message: campaignForm.message,
      recipients: campaignForm.recipients,
      scheduledAt: campaignForm.scheduledAt || undefined,
      status: campaignForm.scheduledAt ? 'scheduled' : 'draft'
    });

    await loadData();
    setShowNewCampaign(false);
    setCampaignForm({ name: '', description: '', templateId: '', message: '', recipients: [], scheduledAt: '' });
    notify('Campaign created!', 'success');
  };

  const handleSendCampaign = async (campaignId: string) => {
    try {
      await whatsAppMarketingService.sendCampaign(campaignId);
      await loadData();
      notify('Campaign sent!', 'success');
    } catch (error) {
      notify('Failed to send campaign', 'error');
    }
  };

  const handleAddRecipient = () => {
    if (recipientInput.trim()) {
      const phones = recipientInput.split(/[\n,]/).map(p => p.trim()).filter(p => p.length > 0);
      setCampaignForm(prev => ({
        ...prev,
        recipients: [...new Set([...prev.recipients, ...phones])]
      }));
      setRecipientInput('');
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setCampaignForm(prev => ({
        ...prev,
        templateId: template.id,
        message: template.content
      }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent': return 'bg-green-100 text-green-700';
      case 'delivered': return 'bg-blue-100 text-blue-700';
      case 'read': return 'bg-emerald-100 text-emerald-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'scheduled': return 'bg-purple-100 text-purple-700';
      case 'sending': return 'bg-yellow-100 text-yellow-700';
      case 'draft': return 'bg-slate-100 text-slate-600';
      case 'active': return 'bg-green-100 text-green-700';
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Promotions': return <Tag size={14} className="text-pink-500" />;
      case 'Support': return <Phone size={14} className="text-blue-500" />;
      case 'Orders': return <Package size={14} className="text-purple-500" />;
      case 'Appointments': return <Calendar size={14} className="text-orange-500" />;
      case 'Billing': return <DollarSign size={14} className="text-green-500" />;
      case 'Examination': return <FileCheck size={14} className="text-indigo-500" />;
      case 'Print': return <Printer size={14} className="text-cyan-500" />;
      case 'Services': return <Star size={14} className="text-amber-500" />;
      case 'Follow-up': return <RefreshCw size={14} className="text-teal-500" />;
      case 'Welcome': return <UserPlus size={14} className="text-emerald-500" />;
      default: return <MessageSquare size={14} className="text-slate-500" />;
    }
  };

  const filteredChats = chats.filter(c => 
    c.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.customerPhone?.includes(searchQuery) ||
    c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTemplates = templates
    .filter(t => templateCategory === 'All' || t.category === templateCategory)
    .sort((a, b) => {
      if (sortBy === 'popular') return b.usageCount - a.usageCount;
      if (sortBy === 'alpha') return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const unreadCount = chats.filter(c => c.status === 'unread').length;
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const categories = ['All', ...whatsAppMarketingService.getTemplateCategories()];

  const Printer = (props: any) => <FileText {...props} />;

  const renderChatMessage = (message: any, index: number) => {
    const isOutbound = message.direction === 'outbound';
    return (
      <div key={message.id || index} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${
          isOutbound
            ? 'bg-green-600 text-white rounded-br-md'
            : 'bg-white text-slate-800 rounded-bl-md shadow-sm'
        }`}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <div className={`flex items-center justify-end gap-1 mt-1 ${
            isOutbound ? 'text-green-200' : 'text-slate-400'
          }`}>
            <span className="text-[10px]">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isOutbound && (
              message.status === 'read' ? <CheckCheck size={14} /> :
              message.status === 'delivered' ? <CheckCircle size={14} /> :
              <Check size={14} />
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading WhatsApp Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-slate-100 overflow-hidden">
      {/* Sidebar - Chat List */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-xl">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">WhatsApp Hub</h1>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Connected
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-slate-800">{unreadCount}</div>
              <div className="text-[10px] text-slate-500">Unread</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-slate-800">{totalCampaigns}</div>
              <div className="text-[10px] text-slate-500">Campaigns</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-slate-800">{totalSent}</div>
              <div className="text-[10px] text-slate-500">Sent</div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex border-b border-slate-200">
          {[
            { id: 'inbox', label: 'Inbox', badge: unreadCount },
            { id: 'campaigns', label: 'Campaigns' },
            { id: 'templates', label: 'Templates' },
            { id: 'automation', label: 'Automation' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`flex-1 px-2 py-3 text-xs font-medium border-b-2 transition-colors ${
                activeView === tab.id 
                  ? 'border-green-600 text-green-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.badge ? (
                <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px]">{tab.badge}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {activeView === 'inbox' ? (
            filteredChats.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No conversations yet</p>
                <button onClick={() => setShowNewCampaign(true)} className="mt-3 text-green-600 font-medium text-sm hover:underline">
                  Start a new campaign
                </button>
              </div>
            ) : (
              filteredChats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedChat?.id === chat.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold flex-shrink-0">
                      {chat.customerName?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className="font-medium text-slate-800 truncate text-sm">{chat.customerName}</h3>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {chat.status === 'unread' && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                        {chat.priority === 'high' && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
                        {chat.tags?.map(tag => (
                          <span key={tag} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : activeView === 'templates' ? (
            <div className="p-2 space-y-1">
              <select
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg mb-2"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="newest">Newest First</option>
                <option value="popular">Most Used</option>
                <option value="alpha">Alphabetical</option>
              </select>
              <div className="text-xs text-slate-500 p-2">
                {filteredTemplates.length} templates available
              </div>
            </div>
          ) : activeView === 'campaigns' ? (
            <div className="p-2">
              <button
                onClick={() => setShowNewCampaign(true)}
                className="w-full flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                <Plus size={16} />
                New Campaign
              </button>
            </div>
          ) : activeView === 'automation' ? (
            <div className="p-2">
              <button
                onClick={() => setShowNewAutomation(true)}
                className="w-full flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                <Plus size={16} />
                New Flow
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* INBOX VIEW */}
        {activeView === 'inbox' && selectedChat ? (
          <>
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedChat(null)} className="lg:hidden text-slate-500"><ArrowLeft size={20} /></button>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
                  {selectedChat.customerName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800">{selectedChat.customerName}</h2>
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Phone size={10} />{selectedChat.customerPhone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><PhoneCall size={18} /></button>
                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Video size={18} /></button>
                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><MoreVertical size={18} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3 bg-slate-50">
              {selectedChat.messages?.map((msg, i) => renderChatMessage(msg, i))}
              <div ref={messagesEndRef} />
            </div>

            {showTemplatePreview && (
              <div className="bg-amber-50 border-t border-amber-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-800">Quick Reply: {showTemplatePreview.name}</span>
                  <button onClick={() => setShowTemplatePreview(null)} className="text-amber-600"><X size={16} /></button>
                </div>
                <p className="text-xs text-amber-700 mb-2 line-clamp-2">{showTemplatePreview.content}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => quickReply(showTemplatePreview)}
                    className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600"
                  >
                    Send Template
                  </button>
                  <button
                    onClick={() => {
                      setCampaignForm(prev => ({ ...prev, message: showTemplatePreview.content, templateId: showTemplatePreview.id }));
                      setShowTemplatePreview(null);
                    }}
                    className="px-3 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border-t border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setShowTemplatePreview(templates[0] || null)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Templates">
                  <FileText size={20} />
                </button>
                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Image size={20} /></button>
                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Smile size={20} /></button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-slate-100 border-0 rounded-full text-sm focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : activeView === 'inbox' ? (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center max-w-md p-8">
              <div className="inline-flex p-4 bg-green-100 rounded-full mb-4">
                <MessageCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">WhatsApp Inbox</h2>
              <p className="text-slate-500 mb-4">Select a conversation or create a campaign</p>
              <button
                onClick={() => setShowNewCampaign(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                <Send size={18} />New Campaign
              </button>
            </div>
          </div>
        ) : null}

        {/* CAMPAIGNS VIEW */}
        {activeView === 'campaigns' && (
          <div className="flex-1 overflow-auto p-6 bg-slate-50">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Campaigns</h2>
                <p className="text-sm text-slate-500">{campaigns.length} total campaigns</p>
              </div>
              <button
                onClick={() => setShowNewCampaign(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                <Plus size={18} />New Campaign
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                <Send className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No campaigns yet</p>
                <button onClick={() => setShowNewCampaign(true)} className="text-green-600 font-medium hover:underline">
                  Create your first campaign
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns.map(campaign => (
                  <div key={campaign.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-slate-800">{campaign.name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{campaign.message}</p>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-slate-800">{campaign.sentCount}</div>
                        <div className="text-[10px] text-slate-500">Sent</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-green-600">{campaign.deliveredCount}</div>
                        <div className="text-[10px] text-slate-500">Delivered</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-blue-600">{campaign.readCount}</div>
                        <div className="text-[10px] text-slate-500">Read</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100">
                        View
                      </button>
                      {campaign.status === 'draft' && (
                        <button 
                          onClick={() => handleSendCampaign(campaign.id)}
                          className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                        >
                          <Send size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TEMPLATES VIEW */}
        {activeView === 'templates' && (
          <div className="flex-1 overflow-auto p-6 bg-slate-50">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Message Templates</h2>
                <p className="text-sm text-slate-500">{templates.length} WhatsApp-approved templates</p>
              </div>
              <button
                onClick={() => setShowNewTemplate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                <Plus size={18} />New Template
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.slice(0, 50).map(template => (
                <div key={template.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(template.category)}
                      <h3 className="font-semibold text-slate-800 text-sm">{template.name}</h3>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      template.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {template.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3 line-clamp-4 whitespace-pre-wrap">{template.content}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span className="bg-slate-100 px-2 py-1 rounded">{template.category}</span>
                    <span>Used {template.usageCount}×</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(template.content);
                        notify('Copied to clipboard!', 'success');
                      }}
                      className="flex-1 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      <Copy size={12} className="inline mr-1" />Copy
                    </button>
                    <button 
                      onClick={() => {
                        setShowTemplatePreview(template);
                        setShowTemplatePreviewModal(true);
                      }}
                      className="flex-1 py-2 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AUTOMATION VIEW */}
        {activeView === 'automation' && (
          <div className="flex-1 overflow-auto p-6 bg-slate-50">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Automation Flows</h2>
                <p className="text-sm text-slate-500">{automations.length} active flows</p>
              </div>
              <button
                onClick={() => setShowNewAutomation(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                <Plus size={18} />New Flow
              </button>
            </div>

            {automations.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                <Bot className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No automation flows yet</p>
                <button onClick={() => setShowNewAutomation(true)} className="text-green-600 font-medium hover:underline">
                  Create your first flow
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {automations.map(flow => (
                  <div key={flow.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <GitBranch size={18} className="text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">{flow.name}</h3>
                          <p className="text-xs text-slate-500">Trigger: {flow.trigger}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        flow.status === 'active' ? 'bg-green-100 text-green-700' : 
                        flow.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {flow.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                      <span>{flow.steps.length} steps</span>
                      <span>{flow.stats.triggered} triggered</span>
                      <span>{flow.stats.completed} completed</span>
                    </div>
                    <div className="flex gap-2">
                      {flow.status === 'active' ? (
                        <button 
                          onClick={() => whatsAppMarketingService.toggleAutomation(flow.id).then(loadData)}
                          className="flex-1 py-2 text-sm font-medium text-yellow-600 bg-yellow-50 rounded-lg hover:bg-yellow-100"
                        >
                          <Pause size={14} className="inline mr-1" />Pause
                        </button>
                      ) : (
                        <button 
                          onClick={() => whatsAppMarketingService.toggleAutomation(flow.id).then(loadData)}
                          className="flex-1 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100"
                        >
                          <Play size={14} className="inline mr-1" />Activate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {showNewCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">New Campaign</h2>
              <button onClick={() => setShowNewCampaign(false)} className="text-slate-500 hover:text-slate-700">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Name *</label>
                <input
                  type="text"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Summer Sale 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={campaignForm.description}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-3 border border-slate-200 rounded-lg"
                  placeholder="Brief description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template (Optional)</label>
                <select
                  value={campaignForm.templateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg"
                >
                  <option value="">Select a template...</option>
                  {templates.slice(0, 20).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message *</label>
                <textarea
                  value={campaignForm.message}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full p-3 border border-slate-200 rounded-lg h-32"
                  placeholder="Enter your message or select a template..."
                />
                <p className="text-xs text-slate-500 mt-1">Use {'{{name}}'} for customer name, {'{{company}}'} for company name</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recipients</label>
                <textarea
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg h-24"
                  placeholder="Enter phone numbers (one per line or comma-separated)&#10;+254712345678&#10;+254798765432"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAddRecipient}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                  >
                    <Plus size={16} className="inline mr-1" />Add Recipients
                  </button>
                  <button 
                    onClick={() => setCampaignForm(prev => ({ ...prev, recipients: [] }))}
                    className="px-4 py-2 text-red-600 text-sm hover:bg-red-50 rounded-lg"
                  >
                    Clear All
                  </button>
                </div>
                {campaignForm.recipients.length > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    {campaignForm.recipients.length} recipient(s) added
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Schedule (Optional)</label>
                <input
                  type="datetime-local"
                  value={campaignForm.scheduledAt}
                  onChange={(e) => setCampaignForm(prev => ({ ...prev, scheduledAt: e.target.value }))}
                  className="w-full p-3 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowNewCampaign(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePreviewCampaign}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Preview
                </button>
                <button
                  onClick={handleCreateCampaign}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  {campaignForm.scheduledAt ? 'Schedule Campaign' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Preview Modal */}
      {showCampaignPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">Campaign Preview</h2>
              <button onClick={() => setShowCampaignPreview(false)} className="text-slate-500 hover:text-slate-700">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Campaign Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name:</span>
                    <span className="font-medium text-slate-800">{campaignForm.name || 'Unnamed Campaign'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Description:</span>
                    <span className="text-slate-800">{campaignForm.description || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recipients:</span>
                    <span className="font-medium text-green-600">{campaignForm.recipients.length} contacts</span>
                  </div>
                  {campaignForm.scheduledAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Scheduled:</span>
                      <span className="text-slate-800">{new Date(campaignForm.scheduledAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Message Preview</label>
                <div className="bg-slate-100 rounded-lg p-4 mb-2">
                  <div className="bg-white rounded-xl border border-slate-200 p-3 max-w-sm ml-auto">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {replaceVars(campaignForm.message)}
                    </p>
                    <p className="text-xs text-slate-400 mt-2 text-right">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">This is how your message will appear to recipients</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Users size={16} className="text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">Variable Substitution</h4>
                    <p className="text-xs text-blue-600 mt-1">
                      Variables like {'{{name}}'} will be automatically replaced with each recipient&apos;s name.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowCampaignPreview(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    handleCreateCampaign();
                    setShowCampaignPreview(false);
                  }}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  {campaignForm.scheduledAt ? 'Schedule Campaign' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {showTemplatePreviewModal && showTemplatePreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Template Preview</h2>
                <p className="text-sm text-green-600">{showTemplatePreview.category}</p>
              </div>
              <button onClick={() => setShowTemplatePreviewModal(false)} className="text-slate-500 hover:text-slate-700">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase">Template Name</span>
                </div>
                <p className="font-medium text-slate-800">{showTemplatePreview.name}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase">Message Preview</span>
                </div>
                <div className="bg-slate-100 rounded-lg p-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-3 max-w-sm ml-auto">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {replaceVars(showTemplatePreview.content)}
                    </p>
                    <p className="text-xs text-slate-400 mt-2 text-right">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Variables will be replaced with actual values when sending</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase">Variables Used</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">{'{{name}}'}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">{'{{company}}'}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">{'{{product}}'}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">{'{{link}}'}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowTemplatePreviewModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setCampaignForm(prev => ({ ...prev, message: showTemplatePreview.content, templateId: showTemplatePreview.id }));
                    setShowTemplatePreviewModal(false);
                    notify('Template loaded to campaign!', 'success');
                  }}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  Use Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingMessages;