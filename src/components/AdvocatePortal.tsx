import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Mic, Camera, FileText, Users, Bell, HelpCircle, 
  BookOpen, Edit3, Layout, MessageSquare, Settings, 
  Download, Globe, Wifi, WifiOff, Shield, Save, Trash2,
  ChevronLeft, ChevronRight, Play, Square, Copy, ExternalLink,
  CheckCircle, AlertTriangle, Info, X, Search, Plus, RotateCcw,
  Volume2, Send, Trash, Check, AlertCircle, LogOut, Upload, File,
  Maximize2, Minimize2, Cpu, Cloud, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from 'react-markdown';
import { VoiceVisualizer } from './VoiceVisualizer';
import { HybridAIEngine, AIMessage, AIResponse } from "../lib/ai-engine";
import { useGeminiLive } from "../hooks/useGeminiLive";
import { LocalDB } from "../lib/local-db";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

// --- Custom Icon Component ---
const Icon = ({ path, size = 20, strokeWidth = 2, style }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {Array.isArray(path) ? path.map((d: string, i: number) => <path key={i} d={d} />) : <path d={path} />}
  </svg>
);

// --- Constants ---
const SIMULATED_CALLS = [
  {
    id: 1,
    clientName: "John Doe",
    phone: "+1 555-0123",
    timestamp: "2026-03-24 10:30 AM",
    duration: "5m 12s",
    transcript: [
      { role: "client", text: "Hello Advocate, I have a property dispute with my brother over our ancestral land in the village." },
      { role: "advocate", text: "I understand. Do you have the title deeds and the family tree document?" },
      { role: "client", text: "Yes, I have all the documents ready." }
    ],
    summary: "Property dispute over ancestral land. Needs to file a partition suit. Documents ready."
  },
  {
    id: 2,
    clientName: "Elena Rodriguez",
    phone: "+1 555-0199",
    timestamp: "2026-03-23 02:15 PM",
    duration: "2m 45s",
    transcript: [
      { role: "client", text: "Advocate, I received a notice from the cooperative society regarding my membership. They are saying I haven't paid the maintenance for 6 months, but I have the receipts." },
      { role: "advocate", text: "Please send me the receipts and the notice. We can reply to them under the Cooperative Societies Act." }
    ],
    summary: "Cooperative society membership notice. Maintenance payment dispute. Client has receipts."
  },
  {
    id: 3,
    clientName: "Sarah Smith",
    phone: "+1 555-0456",
    timestamp: "2026-03-22 11:00 AM",
    duration: "3m 20s",
    transcript: [
      { role: "client", text: "I'm starting a new job and I want you to review the employment contract, especially the non-compete clause." },
      { role: "advocate", text: "Sure, send it over. I'll check if the clause is reasonable and enforceable in your jurisdiction." }
    ],
    summary: "Employment contract review. Non-compete clause concerns. Needs legal opinion."
  }
];

const sideNav = [
  { id: 'command', label: 'Command', icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
  { id: 'feed', label: 'Feed', icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
  { id: 'consult', label: 'Consult', icon: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" },
  { id: 'clients', label: 'Clients', icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: 'knowledge', label: 'Knowledge', icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { id: 'instructions', label: 'Instructions', icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { id: 'drafting', label: 'Drafting', icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
  { id: 'notif', label: 'Notifications', icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
  { id: 'support', label: 'Support', icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" },
  { id: 'read', label: 'Read', icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: 'convert', label: 'Convert', icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
];

const topTabs = [
  { id: 'command', label: 'COMMAND' },
  { id: 'feed', label: 'FEED' },
  { id: 'consult', label: 'CONSULT' },
  { id: 'clients', label: 'CLIENTS' },
  { id: 'knowledge', label: 'KNOWLEDGE' },
  { id: 'instructions', label: 'INSTRUCTIONS' },
  { id: 'drafting', label: 'DRAFTING' },
  { id: 'notif', label: 'NOTIF.' },
  { id: 'support', label: 'SUPPORT' },
  { id: 'read', label: 'READ' },
  { id: 'convert', label: 'CONVERT' },
];

const CONVERTER_STEPS = [
  { id: 1, title: 'Camera Capture', desc: 'Snap photos of physical documents', icon: <Camera size={14} />, color: '#6366f1' },
  { id: 2, title: 'File Upload', desc: 'Select images from your device', icon: <Upload size={14} />, color: '#10b981' },
  { id: 3, title: 'AI Extraction', desc: 'High-precision text recognition', icon: <Search size={14} />, color: '#f59e0b' },
  { id: 4, title: 'AI Translation', desc: 'Convert to any language', icon: <Globe size={14} />, color: '#8b5cf6' },
  { id: 5, title: 'PDF Export', desc: 'Save as professional PDF', icon: <FileText size={14} />, color: '#ef4444' },
  { id: 6, title: 'Word Export', desc: 'Save as editable .docx', icon: <File size={14} />, color: '#3b82f6' },
];

const S = {
  page: { display: 'flex', height: '100vh', background: '#020617', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden', fontSize: 14 },
  sidebar: { width: 72, background: '#070b14', borderRight: '1px solid rgba(255,255,255,.05)', display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center', padding: '0', gap: 8, flexShrink: 0, overflowY: 'auto' as const },
  sideBtn: (active: boolean) => ({ width: '100%', height: 56, background: active ? 'rgba(245,158,11,.05)' : 'transparent', border: 'none', color: active ? '#f59e0b' : '#475569', cursor: 'pointer', display: 'flex' as const, alignItems: 'center', justifyContent: 'center', position: 'relative' as const, transition: 'all .2s', flexShrink: 0 }),
  header: { height: 64, background: '#0a0f1d', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 },
  card: { background: 'rgba(10,15,29,0.7)', borderRadius: 24, padding: 24, border: '1px solid rgba(255,255,255,.05)', backdropFilter: 'blur(10px)' },
};

const NeuralFlow = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 z-0">
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-amber-500/10" />
    <svg className="absolute w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      <motion.path
        d="M0,500 Q250,400 500,500 T1000,500"
        stroke="rgba(99, 102, 241, 0.2)"
        strokeWidth="2"
        fill="none"
        animate={{
          d: [
            "M0,500 Q250,400 500,500 T1000,500",
            "M0,500 Q250,600 500,500 T1000,500",
            "M0,500 Q250,400 500,500 T1000,500"
          ]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.path
        d="M0,600 Q250,500 500,600 T1000,600"
        stroke="rgba(245, 158, 11, 0.1)"
        strokeWidth="1"
        fill="none"
        animate={{
          d: [
            "M0,600 Q250,500 500,600 T1000,600",
            "M0,600 Q250,700 500,600 T1000,600",
            "M0,600 Q250,500 500,600 T1000,600"
          ]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </svg>
  </div>
);

export default function AdvocatePortal({ onBack }: { onBack: () => void }) {
  const [connectionType, setConnectionType] = useState<'wifi' | 'mobile' | 'unknown'>('unknown');
  const [view, setView] = useState("command");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [aiStatus, setAiStatus] = useState<any>({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Connectivity Monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setVoiceAiStatus("System Online");
      setVoiceAiTranscript("Internet connection restored.");
    };
    const handleOffline = () => {
      setIsOffline(true);
      setVoiceAiStatus("Offline Mode");
      setVoiceAiTranscript("Internet connection lost. Some features limited.");
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Doc Converter State
  const [converterImage, setConverterImage] = useState<string | null>(null);
  const [converterText, setConverterText] = useState('');
  const [converterStatus, setConverterStatus] = useState<'idle' | 'processing' | 'done'>('idle');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPreviewEnlarged, setIsPreviewEnlarged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aiEngine = HybridAIEngine.getInstance();
  const localDB = LocalDB.getInstance();
  const geminiLive = useGeminiLive();

  const [clients, setClients] = useState<any[]>([]);
  const [chatHistory, setChatHistory] = useState<AIMessage[]>([]);
  const [voiceHistory, setVoiceHistory] = useState<AIMessage[]>([]);
  const [voiceAiStatus, setVoiceAiStatus] = useState("System Standby");
  const [voiceAiTranscript, setVoiceAiTranscript] = useState("Narrate your case facts now...");
  const [voiceAiReply, setVoiceAiReply] = useState("");
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLoading, setConsoleLoading] = useState(false);
  
  const [scanPhase, setScanPhase] = useState<'idle' | 'starting' | 'live' | 'processing' | 'done' | 'error'>('idle');
  const [scannedText, setScannedText] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [draftPages, setDraftPages] = useState(["IN THE COURT OF THE DISTRICT JUDGE...\n\n[Drafting starts here]"]);
  const [deskInput, setDeskInput] = useState('');
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskChatHistory, setDeskChatHistory] = useState<any[]>([
    { role: 'ai', text: "Welcome to the Writing Desk. I can help you draft petitions and plaints." }
  ]);

  const [draftFacts, setDraftFacts] = useState('');
  const [draftModel, setDraftModel] = useState('');
  const [draftSuggestions, setDraftSuggestions] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [enlargedElement, setEnlargedElement] = useState<'facts' | 'model' | 'pad' | null>(null);
  const enlargedElementRef = useRef(enlargedElement);
  useEffect(() => { enlargedElementRef.current = enlargedElement; }, [enlargedElement]);

  // Doc Converter Logic
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setConverterImage(event.target?.result as string);
      setConverterText('');
      setConverterStatus('idle');
    };
    reader.readAsDataURL(file);
  };

  const processConversion = async () => {
    if (!converterImage) return;
    setConverterStatus('processing');
    try {
      const response = await aiEngine.generateResponse(
        "Please extract all the text from this document for conversion into a formal document. Return only the text content.", 
        [], 
        converterImage,
        'drafting'
      );
      setConverterText(response.text);
      setConverterStatus('done');
    } catch (err) {
      console.error(err);
      setConverterStatus('idle');
    }
  };

  const exportToPDF = () => {
    if (!converterText) return;
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(converterText, 180);
    doc.text(splitText, 10, 10);
    doc.save("converted_document.pdf");
  };

  const exportToWord = async () => {
    if (!converterText) return;
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun(converterText)],
          }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "converted_document.docx");
  };

  const captureForConverter = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);
    const imageBase64 = canvasRef.current.toDataURL('image/jpeg');
    setConverterImage(imageBase64);
    setConverterText('');
    setConverterStatus('idle');
  };

  const handleTranslate = async () => {
    if (!converterText || !targetLanguage) return;
    setIsTranslating(true);
    try {
      const response = await aiEngine.generateResponse(
        `Translate the following legal document text into ${targetLanguage}. Maintain the formal legal tone and formatting. Text: ${converterText}`,
        [],
        undefined,
        'drafting'
      );
      setTranslatedText(response.text);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (view === 'consult') {
      scrollToBottom();
    }
  }, [chatHistory, view]);

  const speakResponse = (response: AIResponse) => {
    const cleanText = response.text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#/g, '')
      .replace(/__/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith('en'));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  const [autoAnswerEnabled, setAutoAnswerEnabled] = useState(false);
  const [callInstructions, setCallInstructions] = useState<{ caller: string, instruction: string }[]>([
    { caller: 'Babu', instruction: 'meet me after 5\'o clock' },
    { caller: 'Clerk', instruction: 'Bring A4 paper' }
  ]);
  const [newCaller, setNewCaller] = useState('');
  const [newInstruction, setNewInstruction] = useState('');
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [callViewTab, setCallViewTab] = useState<'log' | 'transcript'>('log');

  useEffect(() => {
    // Check connection type if supported
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    const updateConnection = () => {
      if (!conn) {
        setConnectionType('wifi'); // Default to wifi if API not supported (common on desktop)
        return;
      }

      // 'type' is more specific (wifi, cellular, etc.) but not always available
      // 'effectiveType' is more about speed (4g, 3g, etc.)
      const type = conn.type;
      const effectiveType = conn.effectiveType;

      if (type) {
        if (type === 'wifi' || type === 'ethernet') {
          setConnectionType('wifi');
        } else if (type === 'cellular') {
          setConnectionType('mobile');
        } else {
          setConnectionType('unknown');
        }
      } else if (effectiveType) {
        // Fallback for browsers that only support effectiveType
        // On desktop, effectiveType '4g' is common for both Wifi and fast Mobile.
        // We'll assume wifi if it's not explicitly cellular (which 'type' would have caught)
        // or if we're on a desktop-like environment.
        if (effectiveType === '4g') setConnectionType('wifi');
        else setConnectionType('mobile');
      } else {
        setConnectionType('wifi');
      }
    };

    if (conn) {
      conn.addEventListener('change', updateConnection);
      updateConnection();
      return () => conn.removeEventListener('change', updateConnection);
    } else {
      updateConnection();
    }
  }, []);


  useEffect(() => {
    const init = async () => {
      await localDB.init();
      const savedClients = localDB.query("SELECT * FROM clients");
      if (savedClients.length > 0) {
        setClients(savedClients);
      } else {
        const initial = [
          { id: 1, name: 'Elena Rodriguez', phone: '+1 555-0199', court: 'District Court, Aluva', case_number: 'OS 145/2025', next_date: '2026-03-15', purpose: 'Filing Written Statement' },
        ];
        initial.forEach(c => {
          localDB.run("INSERT INTO clients (name, phone, case_number, court, next_date, purpose) VALUES (?, ?, ?, ?, ?, ?)", 
            [c.name, c.phone, c.case_number, c.court, c.next_date, c.purpose]);
        });
        setClients(initial);
      }
    };
    init();
  }, []);

  const sendConsult = async (initialText?: string) => {
    const text = initialText || consoleInput.trim();
    if (!text || consoleLoading) return;
    if (!initialText) setConsoleInput("");
    
    const userMsg: AIMessage = { role: 'user', content: text };
    const historyWithUser = [...chatHistory, userMsg];
    setChatHistory(historyWithUser);
    setVoiceHistory(prev => [...prev.slice(-9), userMsg]);
    setConsoleLoading(true);
    
    // Determine task type
    const isSearch = text.toLowerCase().startsWith('search ') || text.toLowerCase().startsWith('find ');
    const task = isSearch ? 'search' : 'general';

    try {
      console.log("Sending smooth request to AI Engine:", text, task);
      const placeholder: AIMessage = { role: 'assistant', content: '', model: "Gemini 2.5 Flash" };
      setChatHistory([...historyWithUser, placeholder]);

      let fullText = "";
      const stream = aiEngine.generateResponseStream(text, historyWithUser, task);
      
      for await (const chunk of stream) {
        fullText += chunk;
        setChatHistory(prev => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText };
          }
          return updated;
        });
      }
      
      // Final sync
      setVoiceHistory(prev => [...prev.slice(-9), { role: 'assistant', content: fullText, model: "Gemini 2.5 Flash" }]);
    } catch (err) { 
      console.error("Consultation Error:", err); 
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Error: Failed to process your request. Please try again.", model: "System" }]);
    } finally { 
      setConsoleLoading(false); 
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDownloadMessage = (text: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_answer_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteMessage = (index: number) => {
    setChatHistory(prev => prev.filter((_, i) => i !== index));
  };

  const handleAIDrafting = async () => {
    if (!draftFacts.trim() || isDrafting) return;
    setIsDrafting(true);
    try {
      const prompt = `Based on the following facts of the case:
${draftFacts}

${draftModel ? `And using this model/template as a guide:
${draftModel}` : ''}

Please draft a formal legal document suitable for submission before a court. 
Maintain a professional legal tone, use appropriate legal terminology, and follow standard court formatting.`;

      const response = await aiEngine.generateResponse(prompt, [], undefined, 'drafting');
      setDraftPages([response.text]);

      // Get suggestions
      const suggestionPrompt = `Review the following legal draft and provide 3-5 specific suggestions for improvement or additional points to consider. Provide the suggestions as a bulleted list. Draft to review:
${response.text}`;
      const suggestions = await aiEngine.generateResponse(suggestionPrompt, [], undefined, 'drafting');
      setDraftSuggestions(suggestions.text);

    } catch (err) {
      console.error(err);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleDownloadDraft = (text: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    saveAs(blob, `Nexus_Draft_${new Date().getTime()}.txt`);
  };

  const sendDeskChat = async () => {
    if (!deskInput.trim() || deskLoading) return;
    const text = deskInput.trim();
    setDeskInput("");
    setDeskChatHistory(prev => [...prev, { role: 'user', text }]);
    setDeskLoading(true);
    try {
      const response = await aiEngine.generateResponse(text, [], undefined, 'drafting');
      setDeskChatHistory(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) { console.error(err); } finally { setDeskLoading(false); }
  };

  const simulateIncomingCall = () => {
    setIncomingCall({
      id: Date.now(),
      clientName: "Elena Rodriguez",
      phone: "+1 555-0199",
      timestamp: new Date().toLocaleString(),
      duration: "0s",
      transcript: [],
      summary: "Incoming Call..."
    });
  };

  const handleAutoAnswer = () => {
    if (!incomingCall) return;
    setIsAnswering(true);
    
    const callerName = incomingCall?.clientName || '';
    const instruction = callInstructions.find(i => 
      callerName.toLowerCase().includes(i.caller.toLowerCase())
    );

    const greeting = instruction 
      ? `Hello, this is the Nexus Justice AI assistant. Regarding your call, ${instruction.instruction}.`
      : `Hello, this is the Nexus Justice AI assistant for ${callerName || 'your call'}. How can I assist you today?`;
    
    const utterance = new SpeechSynthesisUtterance(greeting);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith('en'));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);

    setTimeout(() => {
      setIncomingCall(null);
      setIsAnswering(false);
      geminiLive.connect();
    }, 5000);
  };

  useEffect(() => {
    if (incomingCall && autoAnswerEnabled && !isAnswering) {
      const timer = setTimeout(() => {
        handleAutoAnswer();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [incomingCall, autoAnswerEnabled, isAnswering]);

  const startScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanPhase('live');
    } catch (err) { setScanPhase('error'); }
  };

  const captureScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanPhase('processing');
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);
    const imageBase64 = canvasRef.current.toDataURL('image/jpeg');
    try {
      const response = await aiEngine.generateResponse("Extract text from this legal document. Provide only the text found.", [], imageBase64);
      setScannedText(response.text);
      setScanPhase('done');
      // Auto-read the extracted text
      speakResponse(response);
    } catch (err) { setScanPhase('error'); } finally {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
  };

  return (
    <div style={S.page} className="fixed inset-0 z-[100]">
      {/* SIDEBAR */}
      <div style={S.sidebar} className="custom-scrollbar">
        <div className="w-full aspect-square bg-amber-500 flex items-center justify-center mb-4">
          <span className="text-2xl font-black text-black">T</span>
        </div>
        {sideNav.map(item => (
          <button key={item.id} onClick={() => setView(item.id)} title={item.label} style={S.sideBtn(view === item.id)}>
            <Icon path={item.icon} size={20} />
            {view === item.id && <div style={{ position: 'absolute', left: 0, width: 3, height: 24, background: '#f59e0b', borderRadius: '0 3px 3px 0' }} />}
          </button>
        ))}
        <div className="mt-auto pb-4">
          <button onClick={onBack} className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors" title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={S.header}>
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-black tracking-widest uppercase flex items-center gap-2">
              <span className="text-slate-200">NEXUS</span>
              <span className="text-indigo-500">JUSTICE</span>
              <span className="text-[10px] text-slate-500 font-bold ml-2">GEMINI 2.5 FLASH POWERED</span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest flex items-center gap-2 border transition-all ${
              geminiLive.isConnected 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}>
              <div className={`w-2 h-2 rounded-full ${geminiLive.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              VOICE: {geminiLive.isConnected ? 'LIVE INTERACTION' : 'STANDBY'}
            </div>
            <div className="bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest flex items-center gap-2 border border-indigo-500/20">
              <div className="w-2 h-2 rounded-full bg-indigo-500" /> GEMINI 2.5 FLASH ACTIVE
            </div>
          </div>
        </header>

        <div className="flex bg-[#070b14] border-b border-white/5 px-6 overflow-x-auto whitespace-nowrap custom-scrollbar">
          {topTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-4 py-4 text-[10px] font-black tracking-widest transition-all relative inline-block ${view === tab.id ? 'text-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {tab.label}
              {view === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
            </button>
          ))}
        </div>

        <main style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#020617' }}>
          <NeuralFlow />
          <AnimatePresence mode="wait">
            {view === 'command' && (
              <motion.div key="command" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 24, gap: 24, overflow: 'hidden' }}>
                <div className="flex-1 flex gap-6 overflow-hidden">
                  {/* Left Column */}
                  <div className="w-[400px] flex flex-col gap-6">
                    <div style={S.card} className="relative overflow-hidden">
                      <div className="text-[10px] font-black text-amber-500 tracking-[0.2em] mb-2">GEMINI AI NODE</div>
                      <h2 className="text-4xl font-black italic text-slate-200 mb-8">Command<span className="text-slate-500">Center</span></h2>
                      
                      <div className="bg-white/5 border border-white/5 rounded-3xl p-6 mb-6">
                        <div className="flex justify-between items-center mb-6">
                          <div className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">GEMINI LIVE STATUS</div>
                          <div className={`w-2 h-2 rounded-full transition-all ${geminiLive.isConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`} />
                        </div>
                        
                        <div className="flex gap-3 mb-8">
                          <button 
                            onClick={() => geminiLive.isConnected ? geminiLive.disconnect() : geminiLive.connect()} 
                            className={`flex-1 py-4 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                              geminiLive.isConnected ? 'bg-red-500 text-white shadow-lg' : 'bg-indigo-600 text-white shadow-[0_4px_15px_rgba(99,102,241,0.3)] hover:bg-indigo-500'
                            }`}
                          >
                            {geminiLive.isConnected ? <Square size={18} /> : <Mic size={18} />}
                            {geminiLive.isConnecting ? 'Initializing...' : geminiLive.isConnected ? 'Stop Interaction' : 'Start Gemini Live Voice'}
                          </button>
                        </div>

                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-slate-300">Auto-Answer Incoming Calls</span>
                          <button onClick={() => setAutoAnswerEnabled(!autoAnswerEnabled)} className={`w-10 h-5 rounded-full relative transition-all ${autoAnswerEnabled ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${autoAnswerEnabled ? 'right-0.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-[10px] text-slate-500 font-medium italic">Gemini 2.5 Flash Direct Streaming</div>
                          <button onClick={simulateIncomingCall} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest">Simulate Call</button>
                        </div>
                      </div>

                      {/* AI Auto-Responder Rules (Restored for convenience) */}
                      <div className="bg-white/5 border border-white/5 rounded-3xl p-6 mb-6">
                        <div className="text-[10px] font-black text-amber-400 tracking-widest uppercase mb-4">AUTO-RESPONDER RULES</div>
                        
                        <div className="space-y-3 mb-6 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                          {callInstructions.map((rule, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 group">
                              <div className="flex-1">
                                <div className="text-[10px] font-black text-indigo-400 uppercase">{rule.caller}</div>
                                <div className="text-xs text-slate-300 italic">"{rule.instruction}"</div>
                              </div>
                              <button 
                                onClick={() => setCallInstructions(callInstructions.filter((_, i) => i !== idx))}
                                className="text-slate-500 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          {callInstructions.length === 0 && (
                            <div className="text-[10px] text-slate-500 italic text-center py-4">No active rules</div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <input 
                            value={newCaller}
                            onChange={(e) => setNewCaller(e.target.value)}
                            placeholder="Caller name"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition-all"
                          />
                          <input 
                            value={newInstruction}
                            onChange={(e) => setNewInstruction(e.target.value)}
                            placeholder="Instruction"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition-all"
                          />
                          <button 
                            onClick={() => {
                              if (newCaller && newInstruction) {
                                setCallInstructions([...callInstructions, { caller: newCaller, instruction: newInstruction }]);
                                setNewCaller('');
                                setNewInstruction('');
                              }
                            }}
                            className="w-full py-2 bg-white/5 border border-white/10 rounded-xl font-black text-[10px] text-indigo-400 hover:bg-white/10 transition-all uppercase tracking-widest"
                          >
                            Add Rule
                          </button>
                        </div>
                      </div>

                      {/* Gemini 2.5 Flash Powered Status */}
                      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-3xl p-6 mb-6">
                        <div className="flex justify-between items-center mb-4">
                          <div className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">System Intelligence</div>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-tight">Active</span>
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-slate-200">Gemini 2.5 Flash</div>
                            <div className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">
                              Cloud Unified
                            </div>
                          </div>
                          
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <div className="text-[9px] text-slate-400 italic leading-relaxed">
                              Unified legal intelligence engine. Multimodal support for voice, text, and document analysis.
                            </div>
                          </div>

                          <button 
                            onClick={() => speakResponse({ text: "Nexus Justice is ready. How can I facilitate your legal workflow today?", model: "Gemini 2.5 Flash" })}
                            className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/10 rounded-xl font-black text-[10px] text-indigo-400 hover:text-indigo-300 transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                          >
                            <Volume2 size={12} />
                            Run Audio Diagnostics
                          </button>
                        </div>
                      </div>

                      <div style={S.card} className="flex-1 flex flex-col overflow-hidden p-0">
                        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center">
                          <div className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">Conversation History</div>
                          <div className="text-[10px] font-black text-slate-500 uppercase">{voiceHistory.length} MESSAGES</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                          {voiceHistory.map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                              <div className={`max-w-[85%] p-4 rounded-2xl text-xs ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-300 border border-white/5'}`}>
                                {msg.role === 'assistant' && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <Cpu size={10} className="text-indigo-400" />
                                    <span className="text-[8px] font-black text-indigo-400 tracking-widest uppercase">{msg.model || 'NEXUS AI'}</span>
                                  </div>
                                )}
                                {msg.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-end gap-1.5 h-12 mb-6">
                        {[0.4, 0.7, 0.3, 0.9, 0.5, 0.8, 0.4, 0.6, 0.3, 0.7, 0.5, 0.9, 0.4, 0.6, 0.3, 0.8, 0.5, 0.7].map((h, i) => (
                          <div key={i} className="flex-1 bg-amber-500/80 rounded-full" style={{ height: `${h * 100}%` }} />
                        ))}
                      </div>

                      <div className="text-[10px] font-black text-slate-600 tracking-widest">SYSTEM: CLOUD BRAIN</div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                    <div style={S.card} className="flex-1 flex flex-col overflow-hidden p-0">
                      <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center">
                        <div className="text-[10px] font-black text-amber-500 tracking-widest uppercase">CALL LOGS & TRANSCRIPTS</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase">{SIMULATED_CALLS.length} CALLS RECORDED</div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {SIMULATED_CALLS.map(call => (
                          <div 
                            key={call.id} 
                            onClick={() => setSelectedCall(selectedCall?.id === call.id ? null : call)} 
                            className={`p-5 bg-white/5 border transition-all group rounded-3xl cursor-pointer ${
                              selectedCall?.id === call.id ? 'border-amber-500/50 bg-white/10' : 'border-white/5 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                selectedCall?.id === call.id ? 'bg-amber-500 text-black' : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                              }`}>
                                <Users size={20} />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <div className="font-black text-slate-200">{call.clientName}</div>
                                  <div className="text-[10px] font-black text-slate-500">{call.timestamp}</div>
                                </div>
                                <div className="text-xs text-slate-500 mb-3">{call.phone}</div>
                                <div className="text-xs text-slate-400 italic leading-relaxed">{call.summary}</div>
                              </div>
                              <div className="text-[10px] font-black text-slate-600 self-end">Duration: {call.duration}</div>
                            </div>

                            <AnimatePresence>
                              {selectedCall?.id === call.id && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                                    <div className="text-[9px] font-black text-indigo-400 tracking-widest uppercase mb-2">TRANSCRIPT</div>
                                    <div className="bg-black/20 p-4 rounded-2xl space-y-4 border border-white/5">
                                      {call.transcript?.map((t: any, i: number) => (
                                        <div key={i} className="space-y-1">
                                          <div className={`text-[9px] font-black uppercase tracking-widest ${t.role === 'client' ? 'text-amber-500' : 'text-indigo-400'}`}>{t.role}</div>
                                          <div className="text-sm text-slate-300 leading-relaxed">{t.text}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'consult' && (
              <motion.div key="consult" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#070b14]">
                  <div>
                    <h2 className="text-3xl font-black italic text-slate-200">AI <span className="text-indigo-500">Consult</span></h2>
                    <div className="text-[10px] font-black text-slate-500 tracking-widest uppercase mt-1">Legal Intelligence & Case Analysis</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[9px] font-black text-indigo-400 tracking-widest uppercase">Hybrid Engine Active</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {chatHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                      <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20">
                        <MessageSquare size={40} className="text-indigo-500" />
                      </div>
                      <h3 className="text-xl font-black italic text-slate-300 mb-2">No Active Consultation</h3>
                      <p className="text-sm text-slate-500 max-w-xs">Ask a question or use voice commands to start a legal analysis session.</p>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] p-6 rounded-3xl border ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none' 
                            : 'bg-white/5 border-white/10 text-slate-200 rounded-tl-none'
                        }`}>
                          {msg.role === 'assistant' && (
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-5 h-5 bg-indigo-500 rounded-lg flex items-center justify-center">
                                <Cpu size={12} className="text-white" />
                              </div>
                              <span className="text-[9px] font-black text-indigo-400 tracking-widest uppercase">
                                {msg.model || 'NEXUS AI'}
                              </span>
                            </div>
                          )}
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                          
                          <div className="mt-4 flex items-center justify-between">
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {msg.role === 'assistant' && (
                                <>
                                  <button 
                                    onClick={() => handleCopy(msg.content)}
                                    className="text-slate-500 hover:text-indigo-400 transition-all p-1.5 hover:bg-white/5 rounded-lg"
                                    title="Copy Answer"
                                  >
                                    <Copy size={13} />
                                  </button>
                                  <button 
                                    onClick={() => handleDownloadMessage(msg.content)}
                                    className="text-slate-500 hover:text-indigo-400 transition-all p-1.5 hover:bg-white/5 rounded-lg"
                                    title="Download Answer"
                                  >
                                    <Download size={13} />
                                  </button>
                                </>
                              )}
                              <button 
                                onClick={() => handleDeleteMessage(i)}
                                className={`${msg.role === 'user' ? 'text-white/40 hover:text-white' : 'text-slate-500 hover:text-red-400'} transition-all p-1.5 hover:bg-white/5 rounded-lg`}
                                title="Delete Message"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-6 bg-[#070b14] border-t border-white/5">
                  <div className="max-w-4xl mx-auto relative">
                    <input 
                      value={consoleInput}
                      onChange={(e) => setConsoleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendConsult()}
                      placeholder="Ask the AI anything..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-slate-200 outline-none focus:border-indigo-500/50 transition-all pr-16"
                    />
                    <button 
                      onClick={() => sendConsult()}
                      disabled={consoleLoading}
                      className="absolute right-2 top-2 bottom-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50"
                    >
                      {consoleLoading ? <RotateCcw size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'feed' && (
              <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6 overflow-y-auto space-y-6">
                <h2 className="text-3xl font-black italic text-slate-200">Activity <span className="text-slate-500">Feed</span></h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div style={S.card}>
                    <div className="text-[10px] font-black text-amber-500 tracking-widest mb-4">UPCOMING HEARINGS</div>
                    <div className="space-y-4">
                      {clients.map(c => (
                        <div key={c.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 font-black">{c.name[0]}</div>
                          <div className="flex-1">
                            <div className="text-sm font-bold">{c.name}</div>
                            <div className="text-[10px] text-slate-500">{c.court}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-black text-emerald-500">{c.next_date}</div>
                            <div className="text-[9px] text-slate-600">{c.purpose}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={S.card}>
                    <div className="text-[10px] font-black text-indigo-500 tracking-widest mb-4">PLATFORM UPDATES</div>
                    <div className="space-y-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="text-sm font-bold mb-1">Nexus v3.1 Released</div>
                        <div className="text-xs text-slate-500">New hybrid AI engine with offline support is now active.</div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="text-sm font-bold mb-1">Bar Council Integration</div>
                        <div className="text-xs text-slate-500">Direct filing integration for High Court is coming soon.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'clients' && (
              <motion.div key="clients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6 overflow-y-auto space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black italic text-slate-200">Client <span className="text-slate-500">Registry</span></h2>
                  <button className="bg-indigo-600 px-6 py-2.5 rounded-2xl font-black text-xs tracking-widest uppercase">Add Client</button>
                </div>
                <div style={S.card} className="overflow-hidden p-0">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Name</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Case Number</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Court</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Next Date</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {clients.map(c => (
                        <tr key={c.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold">{c.name}</div>
                            <div className="text-[10px] text-slate-500">{c.phone}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded text-[10px] font-black">{c.case_number}</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">{c.court}</td>
                          <td className="px-6 py-4 text-xs text-emerald-500 font-bold">{c.next_date}</td>
                          <td className="px-6 py-4">
                            <button className="text-slate-500 hover:text-white transition-colors"><Edit3 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {view === 'knowledge' && (
              <motion.div key="knowledge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6 overflow-y-auto space-y-6">
                <h2 className="text-3xl font-black italic text-slate-200">Legal <span className="text-slate-500">Knowledge Base</span></h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { title: 'The Railways Act, 1989', category: 'Railway Law', year: '1989' },
                    { title: 'Transfer of Property Act, 1882', category: 'Property Law', year: '1882' },
                    { title: 'Indian Penal Code', category: 'Criminal Law', year: '1860' },
                    { title: 'Cooperative Societies Act', category: 'Cooperative Law', year: '1912' },
                    { title: 'Industrial Disputes Act', category: 'Labour Law', year: '1947' },
                  ].map((doc, i) => (
                    <div key={i} style={S.card} className="group hover:border-indigo-500/30 transition-all cursor-pointer">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-all">
                        <BookOpen size={24} />
                      </div>
                      <div className="text-[9px] font-black text-indigo-500 tracking-widest uppercase mb-1">{doc.category}</div>
                      <div className="text-sm font-bold mb-2">{doc.title}</div>
                      <div className="text-[10px] text-slate-500">Enacted: {doc.year}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'drafting' && (
              <motion.div key="drafting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex overflow-hidden">
                {/* Left Panel: Inputs */}
                <div className="w-80 flex flex-col border-r border-white/5 bg-[#070b14]">
                  <div className="p-6 border-b border-white/5">
                    <div className="text-[10px] font-black text-indigo-500 tracking-widest uppercase">CASE INPUTS</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Fact of the Case</label>
                        <button onClick={() => setEnlargedElement('facts')} className="p-1 text-slate-500 hover:text-indigo-400 transition-colors" title="Enlarge">
                          <Maximize2 size={12} />
                        </button>
                      </div>
                      <textarea 
                        value={draftFacts} 
                        onChange={e => setDraftFacts(e.target.value)}
                        placeholder="Enter the facts of the case here..."
                        className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-slate-300 focus:border-indigo-500 transition-colors resize-none custom-scrollbar"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Model Draft / Template</label>
                        <button onClick={() => setEnlargedElement('model')} className="p-1 text-slate-500 hover:text-indigo-400 transition-colors" title="Enlarge">
                          <Maximize2 size={12} />
                        </button>
                      </div>
                      <textarea 
                        value={draftModel} 
                        onChange={e => setDraftModel(e.target.value)}
                        placeholder="Upload or paste a model draft..."
                        className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-slate-300 focus:border-indigo-500 transition-colors resize-none custom-scrollbar"
                      />
                    </div>
                    <button 
                      onClick={handleAIDrafting}
                      disabled={isDrafting || !draftFacts.trim()}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-black text-[10px] text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      {isDrafting ? <RotateCcw size={14} className="animate-spin" /> : <Zap size={14} />}
                      {isDrafting ? "GENERATING..." : "GENERATE DRAFT"}
                    </button>
                  </div>
                </div>

                {/* Middle Panel: Writing Pad */}
                <div className="flex-1 flex flex-col border-r border-white/5">
                  <div className="h-12 bg-white/5 border-b border-white/5 flex items-center justify-between px-6">
                    <div className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">TEMPORARY WRITING PAD</div>
                    <div className="flex gap-2">
                      <button onClick={() => setEnlargedElement('pad')} className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors" title="Enlarge"><Maximize2 size={16} /></button>
                      <button onClick={() => handleCopy(draftPages[0])} className="p-1.5 text-slate-500 hover:text-white transition-colors" title="Copy"><Copy size={16} /></button>
                      <button onClick={() => handleDownloadDraft(draftPages[0])} className="p-1.5 text-slate-500 hover:text-white transition-colors" title="Download"><Download size={16} /></button>
                    </div>
                  </div>
                  <div className="flex-1 p-10 bg-black/20 overflow-y-auto custom-scrollbar">
                    <div className="max-w-2xl mx-auto bg-white/5 p-12 rounded-lg shadow-2xl min-h-full font-serif text-slate-300 leading-relaxed whitespace-pre-wrap outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => setDraftPages([e.currentTarget.innerText])}>
                      {draftPages[0]}
                    </div>
                  </div>
                </div>

                {/* Right Panel: Suggestions & Chat */}
                <div className="w-80 flex flex-col bg-[#070b14]">
                  <div className="p-6 border-b border-white/5">
                    <div className="text-[10px] font-black text-emerald-500 tracking-widest uppercase">AI SUGGESTIONS</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {draftSuggestions && (
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
                        <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Info size={12} /> Improvement Points
                        </div>
                        <div className="text-[11px] text-slate-300 leading-relaxed">
                          <ReactMarkdown>{draftSuggestions}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="text-[10px] font-black text-slate-500 tracking-widest uppercase">CHAT ASSISTANT</div>
                      {deskChatHistory.map((msg, i) => (
                        <div key={i} className={`p-4 rounded-2xl text-xs leading-relaxed ${msg.role === 'ai' ? 'bg-white/5 border border-white/10' : 'bg-indigo-600/20 border border-indigo-600/30'}`}>
                          {msg.text}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 border-t border-white/5">
                    <div className="flex gap-2">
                      <input value={deskInput} onChange={e => setDeskInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendDeskChat()} placeholder="Refine draft..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs" />
                      <button onClick={sendDeskChat} className="bg-indigo-600 p-2 rounded-xl"><Send size={14} /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'notif' && (
              <motion.div key="notif" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6 overflow-y-auto space-y-6">
                <h2 className="text-3xl font-black italic text-slate-200">Notifications</h2>
                <div className="space-y-4">
                  {[
                    { title: 'System Update', message: 'Nexus Justice v3.1 is now live with hybrid AI capabilities.', time: '2 hours ago', type: 'info' },
                    { title: 'New Case Assigned', message: 'You have a new case request from Elena Rodriguez.', time: '5 hours ago', type: 'case' },
                    { title: 'Subscription Renewal', message: 'Your Elite plan expires in 15 days.', time: '1 day ago', type: 'warning' },
                  ].map((n, i) => (
                    <div key={i} style={S.card} className="flex gap-4 items-start">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${n.type === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                        {n.type === 'warning' ? <AlertTriangle size={20} /> : <Info size={20} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <div className="text-sm font-bold">{n.title}</div>
                          <div className="text-[10px] text-slate-500">{n.time}</div>
                        </div>
                        <div className="text-xs text-slate-400 leading-relaxed">{n.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'support' && (
              <motion.div key="support" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6 flex flex-col gap-4">
                <h2 className="text-3xl font-black italic text-slate-200">Help & <span className="text-slate-500">Support</span></h2>
                <div className="flex-1 bg-slate-900/50 border border-white/5 rounded-3xl p-6 overflow-y-auto space-y-4">
                  <div className="flex justify-start">
                    <div className="max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed bg-white/5 border border-white/10">
                      Hello! I am the Nexus Support Assistant. How can I help you today?
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <input placeholder="Describe your issue..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm" />
                  <button className="bg-indigo-600 px-6 rounded-2xl font-bold">Send</button>
                </div>
              </motion.div>
            )}

            {view === 'read' && (
              <motion.div key="read" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6 flex gap-6">
                <div className="w-1/2 flex flex-col gap-4">
                  <div className="flex-1 bg-black rounded-3xl overflow-hidden relative border border-white/10">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    {scanPhase === 'processing' && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <div className="text-xs font-black tracking-widest uppercase text-indigo-400">Analyzing Document</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={scanPhase === 'live' ? captureScan : startScan} className="flex-1 py-4 bg-emerald-600 rounded-2xl font-bold flex items-center justify-center gap-2">
                      {scanPhase === 'live' ? <Camera size={20} /> : <Play size={20} />}
                      {scanPhase === 'live' ? 'Capture & Read' : 'Start Camera'}
                    </button>
                    {scannedText && (
                      <button onClick={() => speakResponse({ text: scannedText, model: "OCR" })} className="p-4 bg-indigo-600 rounded-2xl">
                        <Volume2 size={24} />
                      </button>
                    )}
                    {scannedText && (
                      <button 
                        onClick={() => {
                          setDraftFacts(prev => prev + (prev.trim() ? "\n\n" : "") + scannedText);
                          setView('drafting');
                          setEnlargedElement('facts');
                        }} 
                        className="p-4 bg-emerald-600 rounded-2xl"
                        title="Send to Drafting Facts"
                      >
                        <Plus size={24} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 bg-slate-900/50 border border-white/5 rounded-3xl p-6 overflow-y-auto relative">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Extracted Text</div>
                    {scannedText && <button onClick={() => setScannedText("")} className="text-slate-500 hover:text-white text-[10px] uppercase font-black tracking-widest">Clear</button>}
                  </div>
                  <div className="text-sm text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">{scannedText || "Waiting for capture..."}</div>
                </div>
              </motion.div>
            )}

            {view === 'convert' && (
              <motion.div key="convert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-6 flex gap-6 overflow-hidden">
                {/* Left Sidebar: Tools & Image Preview */}
                <div className="w-[280px] flex flex-col gap-4 flex-shrink-0 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6">
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-4">Nexus Tools</div>
                    <h3 className="text-2xl font-black italic mb-6">Doc<span className="text-slate-500">Converter</span></h3>
                    
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => {
                          if (scanPhase !== 'live') startScan();
                          else captureForConverter();
                        }} 
                        className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-bold flex items-center justify-center gap-3 text-indigo-400 hover:bg-white/10 transition-all"
                      >
                        <Camera size={20} /> {scanPhase === 'live' ? 'Capture Document' : 'Use Camera'}
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-bold flex items-center justify-center gap-3 text-emerald-400 hover:bg-white/10 transition-all"
                      >
                        <Upload size={20} /> Upload from Device
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    </div>
                  </div>

                  {converterImage && (
                    <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-4 flex flex-col gap-4">
                      <div className="aspect-[3/4] bg-black rounded-2xl overflow-hidden border border-white/10">
                        <img src={converterImage} alt="Preview" className="w-full h-full object-contain" />
                      </div>
                      <button 
                        onClick={processConversion} 
                        disabled={converterStatus === 'processing'} 
                        className="w-full py-4 bg-indigo-600 rounded-2xl font-bold disabled:opacity-50"
                      >
                        {converterStatus === 'processing' ? 'AI Processing...' : 'Extract & Convert'}
                      </button>
                    </div>
                  )}

                  {converterStatus === 'done' && (
                    <div className="flex flex-col gap-3">
                      <button onClick={exportToPDF} className="w-full py-4 bg-red-600/20 border border-red-600/30 text-red-500 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-red-600/30 transition-all">
                        <FileText size={20} /> Export as PDF
                      </button>
                      <button onClick={exportToWord} className="w-full py-4 bg-blue-600/20 border border-blue-600/30 text-blue-500 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-600/30 transition-all">
                        <File size={20} /> Export as Word
                      </button>
                      <button 
                        onClick={() => {
                          setDraftFacts(prev => prev + (prev.trim() ? "\n\n" : "") + scannedText);
                          setView('drafting');
                          setEnlargedElement('facts');
                        }} 
                        className="w-full py-4 bg-emerald-600/20 border border-emerald-600/30 text-emerald-500 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-600/30 transition-all"
                      >
                        <Plus size={20} /> Send to Drafting Facts
                      </button>
                    </div>
                  )}
                </div>

                {/* Main Area: Document Text Preview */}
                <div className="flex-1 bg-slate-900/50 border border-white/5 rounded-3xl p-8 flex flex-col overflow-hidden relative">
                  <div className="flex justify-between items-center mb-6">
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Document Preview</div>
                    <div className="flex items-center gap-4">
                      {converterStatus === 'done' && (
                        <div className="flex items-center gap-2 text-emerald-500">
                          <CheckCircle size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Ready for Export</span>
                        </div>
                      )}
                      <button 
                        onClick={() => setIsPreviewEnlarged(true)}
                        className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                        title="Enlarge Preview"
                      >
                        <Maximize2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 bg-black/40 rounded-3xl p-8 overflow-y-auto font-mono text-sm text-slate-400 leading-relaxed whitespace-pre-wrap border border-white/5">
                    {converterText || (converterStatus === 'processing' ? "Nexus AI is analyzing the document structure and content..." : "Capture or upload a document to begin the conversion process.")}
                  </div>
                </div>

                {/* Enlarge Modal Overlay */}
                <AnimatePresence>
                  {isPreviewEnlarged && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl p-12 flex flex-col"
                    >
                      <div className="flex justify-between items-center mb-8">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">Nexus AI Document Preview</div>
                          <h2 className="text-3xl font-black italic">Full View<span className="text-slate-500">Mode</span></h2>
                        </div>
                        <button 
                          onClick={() => setIsPreviewEnlarged(false)}
                          className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                          <Minimize2 size={24} />
                        </button>
                      </div>
                      <div className="flex-1 bg-slate-900/50 border border-white/5 rounded-[40px] p-12 overflow-y-auto font-mono text-lg text-slate-300 leading-loose whitespace-pre-wrap">
                        {converterText}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Right Sidebar: AI Translation & Arrangements */}
                <div className="w-[340px] flex flex-col gap-6 flex-shrink-0 overflow-y-auto pr-2 custom-scrollbar">
                  {converterStatus === 'done' && (
                    <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">AI Translation</div>
                        {isTranslating && <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 animate-pulse">Translating...</div>}
                      </div>
                      <div className="flex flex-col gap-3">
                        <input 
                          value={targetLanguage}
                          onChange={(e) => setTargetLanguage(e.target.value)}
                          placeholder="Target language..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500/50 transition-all"
                        />
                        <button 
                          onClick={handleTranslate}
                          disabled={isTranslating || !targetLanguage}
                          className="w-full py-3 bg-indigo-600 rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2"
                        >
                          {isTranslating ? <RotateCcw size={14} className="animate-spin" /> : <Globe size={14} />}
                          Translate Document
                        </button>
                      </div>
                      {translatedText && (
                        <div className="mt-2 p-4 bg-black/40 rounded-xl border border-white/5 max-h-[300px] overflow-y-auto text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                          {translatedText}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6">
                    <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">System Arrangements</div>
                    <div className="flex flex-col gap-3">
                      {CONVERTER_STEPS.map(step => (
                        <button 
                          key={step.id} 
                          onClick={() => {
                            if (step.id === 1) {
                              if (scanPhase !== 'live') startScan();
                              else captureForConverter();
                            } else if (step.id === 2) {
                              fileInputRef.current?.click();
                            } else if (step.id === 3) {
                              if (converterImage) processConversion();
                            } else if (step.id === 4) {
                              if (converterStatus === 'done') handleTranslate();
                            } else if (step.id === 5) {
                              if (converterStatus === 'done') exportToPDF();
                            } else if (step.id === 6) {
                              if (converterStatus === 'done') exportToWord();
                            }
                          }}
                          disabled={
                            (step.id === 3 && (!converterImage || converterStatus === 'processing')) ||
                            (step.id >= 4 && converterStatus !== 'done') ||
                            (step.id === 4 && isTranslating)
                          }
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 group hover:border-white/10 transition-all text-left disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${step.color}15`, color: step.color }}>
                            {step.icon}
                          </div>
                          <div>
                            <div className="text-[11px] font-black text-slate-200 mb-0.5">{step.title}</div>
                            <div className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter">{step.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {view === 'instructions' && (
              <motion.div key="instructions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-100 p-8 flex flex-col gap-8 overflow-hidden">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-[10px] font-black text-amber-500 tracking-[0.2em] mb-2 uppercase">System Configuration</div>
                    <h2 className="text-5xl font-black italic text-slate-200">Auto-Responder<span className="text-slate-500">Rules</span></h2>
                  </div>
                  <div className="flex items-center gap-6 bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
                    <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enable auto answering?</span>
                      <button onClick={() => setAutoAnswerEnabled(!autoAnswerEnabled)} className={`w-10 h-5 rounded-full relative transition-all ${autoAnswerEnabled ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${autoAnswerEnabled ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Rules</div>
                        <div className="text-2xl font-black text-indigo-500">{callInstructions.length}</div>
                      </div>
                      <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                        <Shield size={20} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex gap-8 overflow-hidden">
                  {/* Rules List */}
                  <div className="flex-1 bg-slate-900/50 border border-white/5 rounded-[40px] p-8 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-8">
                      <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Instruction Registry</div>
                      <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold">
                        <Info size={12} />
                        AI will use these rules to answer calls automatically
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
                      {callInstructions.map((rule, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={idx} 
                          className="p-6 bg-white/5 border border-white/5 rounded-3xl flex justify-between items-center group hover:bg-white/10 transition-all"
                        >
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 font-black text-xl">
                              {rule.caller.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">{rule.caller}</div>
                              <div className="text-xl font-medium text-slate-200 italic">"{rule.instruction}"</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => setCallInstructions(callInstructions.filter((_, i) => i !== idx))}
                            className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={20} />
                          </button>
                        </motion.div>
                      ))}
                      {callInstructions.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 py-20">
                          <Shield size={48} className="mb-4 opacity-20" />
                          <div className="text-sm font-bold uppercase tracking-widest">No Active Rules</div>
                          <div className="text-[10px] mt-2">Add a rule to enable automated responses</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Rule Sidebar */}
                  <div className="w-[400px] flex flex-col gap-6">
                    <div className="bg-slate-900/50 border border-white/5 rounded-[40px] p-8">
                      <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-8">Deploy New Rule</div>
                      
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Caller Identity</label>
                          <input 
                            value={newCaller}
                            onChange={(e) => setNewCaller(e.target.value)}
                            placeholder="e.g. Babu, Clerk, Client Name..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-slate-200 outline-none focus:border-indigo-500/50 transition-all font-medium"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">AI Instruction</label>
                          <textarea 
                            value={newInstruction}
                            onChange={(e) => setNewInstruction(e.target.value)}
                            placeholder="What should the AI say?..."
                            rows={4}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-slate-200 outline-none focus:border-indigo-500/50 transition-all font-medium resize-none"
                          />
                        </div>

                        <button 
                          onClick={() => {
                            if (newCaller && newInstruction) {
                              setCallInstructions([...callInstructions, { caller: newCaller, instruction: newInstruction }]);
                              setNewCaller('');
                              setNewInstruction('');
                            }
                          }}
                          disabled={!newCaller || !newInstruction}
                          className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 rounded-2xl font-black text-sm text-white transition-all uppercase tracking-[0.2em] shadow-[0_8px_30px_rgba(79,70,229,0.3)]"
                        >
                          Register Rule
                        </button>
                      </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-[40px] p-8">
                      <div className="flex items-center gap-3 text-amber-500 mb-4">
                        <AlertTriangle size={20} />
                        <div className="text-[10px] font-black uppercase tracking-widest">System Note</div>
                      </div>
                      <p className="text-xs text-amber-500/70 leading-relaxed font-medium">
                        Auto-responder rules are matched against incoming caller names. Ensure the names match your client registry for maximum accuracy.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Nexus Link Dock */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] flex flex-col items-center gap-4">
        <AnimatePresence>
          {geminiLive.isConnected && (
            <motion.div 
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.9 }}
              className="bg-black/90 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 w-[400px] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    geminiLive.isModelSpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {geminiLive.isModelSpeaking ? 'Nexus Speaking' : 'Listening...'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => geminiLive.disconnect()}
                    className="p-2 bg-white/5 hover:bg-red-500/20 rounded-xl text-slate-500 hover:text-red-500 transition-all flex items-center gap-2"
                    title="Close Conversation"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest px-1">Close</span>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-3">
                  <VoiceVisualizer 
                    volume={geminiLive.volume} 
                    isModelSpeaking={geminiLive.isModelSpeaking} 
                    isThinking={false}
                    isConnected={geminiLive.isConnected} 
                  />
                  <div className="text-sm font-medium text-white italic text-center w-full min-h-[1.25rem]">
                    {geminiLive.messages.length > 0 ? geminiLive.messages[geminiLive.messages.length - 1].text : "Live Audio Optimized"}
                  </div>
                </div>
                {voiceAiReply && (
                  <div className="text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-3 flex justify-between items-start gap-4">
                    <div className="flex-1">{voiceAiReply}</div>
                    <button 
                      onClick={() => speakResponse({ text: voiceAiReply, model: "NEXUS AI" })}
                      className="p-1.5 bg-white/5 rounded-lg text-slate-500 hover:text-white transition-colors"
                      title="Replay Audio"
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          <button 
            onClick={() => {
              setView('read');
              if (scanPhase !== 'live') startScan();
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              view === 'read' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Camera size={20} />
          </button>
          <button 
            onClick={() => geminiLive.isConnected ? geminiLive.disconnect() : geminiLive.connect()}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-all relative ${
              geminiLive.isConnected ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]'
            }`}
          >
            {geminiLive.isConnected ? <X size={24} /> : <Mic size={24} />}
            {geminiLive.isConnected && (
              <motion.div 
                layoutId="mic-glow"
                className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
              />
            )}
          </button>
          <div className="flex flex-col">
            <div className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">NEXUS LINK</div>
            <div className="text-[10px] font-black uppercase flex items-center gap-1.5">
              {geminiLive.isConnected ? (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-500">ACTIVE</span>
                  <div className="w-8 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ width: `${Math.min(100, geminiLive.volume * 1000)}%` }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <span className="text-slate-500">READY</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Incoming Call Overlay */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-10 right-10 w-80 bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl z-[200]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center animate-pulse"><Volume2 size={24} /></div>
              <div>
                <div className="font-bold">{incomingCall.clientName}</div>
                <div className="text-xs text-slate-500">Incoming Call...</div>
              </div>
            </div>
            {isAnswering ? (
              <div className="text-center text-emerald-500 font-bold text-sm animate-pulse">AI Answering...</div>
            ) : (
              <div className="flex gap-3">
                <button onClick={handleAutoAnswer} className="flex-1 py-3 bg-emerald-600 rounded-xl font-bold text-sm">Answer</button>
                <button onClick={() => setIncomingCall(null)} className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-sm">Decline</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enlarged Element Modal */}
      <AnimatePresence>
        {enlargedElement && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[400] flex items-center justify-center p-10">
            <div className="max-w-5xl w-full h-full bg-slate-900 border border-white/10 rounded-[40px] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em]">
                  {enlargedElement === 'facts' && "ENLARGED: FACT OF THE CASE"}
                  {enlargedElement === 'model' && "ENLARGED: MODEL DRAFT / TEMPLATE"}
                  {enlargedElement === 'pad' && "ENLARGED: TEMPORARY WRITING PAD"}
                </div>
                <button onClick={() => setEnlargedElement(null)} className="p-2 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 p-10 overflow-y-auto custom-scrollbar bg-black/20">
                {enlargedElement === 'facts' && (
                  <textarea 
                    value={draftFacts} 
                    onChange={e => setDraftFacts(e.target.value)}
                    className="w-full h-full bg-transparent text-lg text-slate-300 font-serif leading-relaxed outline-none resize-none"
                    placeholder="Enter facts..."
                    autoFocus
                  />
                )}
                {enlargedElement === 'model' && (
                  <textarea 
                    value={draftModel} 
                    onChange={e => setDraftModel(e.target.value)}
                    className="w-full h-full bg-transparent text-lg text-slate-300 font-serif leading-relaxed outline-none resize-none"
                    placeholder="Enter model draft..."
                    autoFocus
                  />
                )}
                {enlargedElement === 'pad' && (
                  <div 
                    className="w-full h-full bg-transparent text-xl text-slate-300 font-serif leading-relaxed outline-none whitespace-pre-wrap"
                    contentEditable 
                    suppressContentEditableWarning 
                    onBlur={(e) => setDraftPages([e.currentTarget.innerText])}
                    autoFocus
                  >
                    {draftPages[0]}
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-white/5 bg-white/5 flex justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  {enlargedElement === 'facts' && (
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center gap-2">
                        <button 
                          onClick={() => geminiLive.isConnected ? geminiLive.disconnect() : geminiLive.connect()}
                          className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-white transition-all relative ${
                            geminiLive.isConnected ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                          }`}
                        >
                          {geminiLive.isConnected ? <X size={28} /> : <Mic size={28} />}
                          {geminiLive.isConnected && (
                            <motion.div 
                              layoutId="mic-glow-modal"
                              className="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping"
                            />
                          )}
                        </button>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dictate Story</span>
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <button 
                          onClick={() => {
                            setEnlargedElement(null);
                            setView('read');
                            if (scanPhase !== 'live') startScan();
                          }}
                          className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                          <Camera size={28} />
                        </button>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scan Facts</span>
                      </div>

                      {geminiLive.isConnected ? (
                        <div className="flex flex-col ml-4">
                          <div className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">STORYTELLING ACTIVE</div>
                          <div className="text-sm text-emerald-500 font-bold animate-pulse max-w-md truncate">
                            {geminiLive.messages.length > 0 ? geminiLive.messages[geminiLive.messages.length - 1].text : "Narrate your case facts now..."}
                          </div>
                        </div>
                      ) : (
                        <div className="ml-4 hidden md:block">
                          <div className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1">Quick Tip</div>
                          <div className="text-xs text-slate-400 italic">"Use the mic to narrate the story of the case. Gemini will process it in real-time."</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-4">
                  {enlargedElement === 'pad' && (
                    <>
                      <button onClick={() => handleCopy(draftPages[0])} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
                        <Copy size={16} /> Copy Content
                      </button>
                      <button onClick={() => handleDownloadDraft(draftPages[0])} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
                        <Download size={16} /> Download Draft
                      </button>
                    </>
                  )}
                  <button onClick={() => setEnlargedElement(null)} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-[40px] p-10 text-center">
              <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-8"><span className="text-4xl font-black italic text-black">N</span></div>
              <h2 className="text-3xl font-black italic mb-4">Nexus Justice</h2>
              <p className="text-slate-400 mb-10 leading-relaxed">Your AI-powered legal command center. Manage calls, consult laws, and draft documents seamlessly.</p>
              <button onClick={() => setShowOnboarding(false)} className="w-full py-5 bg-indigo-600 rounded-2xl font-black uppercase tracking-widest">Enter Portal</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
