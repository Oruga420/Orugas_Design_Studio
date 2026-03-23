/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { generateImages, rewritePromptAsJson, suggestAdvancedField, ImageOptions } from './services/gemini';
import { 
  Loader2, Download, Sparkles, Image as ImageIcon, 
  Settings2, Key, Sliders, Layout, Zap, Code, 
  Camera, Maximize, Sun, Palette, Brush, ChevronRight, ChevronLeft,
  Upload, Link as LinkIcon, Clipboard, X, Plus, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { PixelTrail } from './components/ui/pixel-trail';
import { TextScramble } from './components/ui/text-scramble';
import { useScreenSize } from './components/hooks/use-screen-size';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { Input } from './components/ui/input';
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogTitle,
  MorphingDialogImage,
  MorphingDialogSubtitle,
  MorphingDialogClose,
  MorphingDialogDescription,
  MorphingDialogContainer,
} from './components/ui/morphing-dialog';

// Declare window.aistudio for TypeScript
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const ASPECT_RATIOS = ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"];
const RESOLUTIONS = ["512", "1K", "2K", "4K"];

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [rewriting, setRewriting] = useState(false);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'system'>('basic');

  // Basic Options
  const [imageCount, setImageCount] = useState(1);
  const [arIndex, setArIndex] = useState(0);
  const [resIndex, setResIndex] = useState(1);
  const [mode, setMode] = useState<'normal' | 'batch'>('normal');
  const [model, setModel] = useState<'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image-preview'>('gemini-3.1-flash-image-preview');

  // System Options
  const [useSearch, setUseSearch] = useState(false);
  const [useImageSearch, setUseImageSearch] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<'Minimal' | 'High'>('Minimal');
  const [showThoughts, setShowThoughts] = useState(false);
  const [advanced, setAdvanced] = useState({
    camera: '',
    angle: '',
    lighting: '',
    filter: '',
    style: ''
  });

  const screenSize = useScreenSize();

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    try {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    } catch (e) {
      console.error("Error checking API key:", e);
      setHasKey(false);
    }
  };

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    setHasKey(true);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setPendingCount(prev => prev + 1);
    setError(null);

    try {
      const options: ImageOptions = {
        aspectRatio: ASPECT_RATIOS[arIndex],
        imageSize: RESOLUTIONS[resIndex],
        count: imageCount,
        mode,
        model,
        referenceImages,
        baseImage: baseImage || undefined,
        useSearch,
        useImageSearch,
        thinkingLevel,
        includeThoughts: showThoughts,
        advanced: activeTab === 'advanced' ? advanced : undefined
      };
      
      const result = await generateImages(prompt, options);
      if (result.images.length > 0) {
        setImages(prev => [...result.images, ...prev]);
        if (result.thoughts) {
          setThoughts(prev => [...result.thoughts!, ...prev]);
        }
        setBaseImage(null); // Clear base image after edit
      } else {
        setError("No images were generated. Please try a different prompt.");
      }
    } catch (err: any) {
      if (err?.message?.includes("Requested entity was not found")) {
        setError("API Key error. Please re-select your API key.");
        setHasKey(false);
      } else {
        setError("Failed to generate images. Please try again.");
      }
      console.error(err);
    } finally {
      setPendingCount(prev => prev - 1);
    }
  };

  const handleRewriteJson = async () => {
    if (!prompt.trim()) return;
    setRewriting(true);
    try {
      const jsonPrompt = await rewritePromptAsJson(prompt);
      setPrompt(jsonPrompt);
    } catch (e) {
      console.error(e);
    } finally {
      setRewriting(false);
    }
  };

  const handleSuggest = async (field: string) => {
    if (!prompt.trim()) return;
    setSuggesting(field);
    try {
      const suggestion = await suggestAdvancedField(field, prompt, advanced);
      if (suggestion) {
        setAdvanced(prev => ({ ...prev, [field]: suggestion }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSuggesting(null);
    }
  };

  const addReferenceImage = (base64: string) => {
    if (referenceImages.length >= 14) return;
    setReferenceImages(prev => [...prev, base64]);
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          addReferenceImage(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file as File);
    });
  };

  const handleUrlUpload = async () => {
    const url = window.prompt("Enter image URL:");
    if (!url) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          addReferenceImage(ev.target.result as string);
        }
      };
      reader.readAsDataURL(blob as Blob);
    } catch (e) {
      alert("Failed to fetch image from URL. It might be a CORS issue.");
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result) {
                addReferenceImage(ev.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [referenceImages]);

  const handleDownload = (img: string, index: number) => {
    const link = document.createElement('a');
    link.href = img;
    link.download = `nano-banana-2-${Date.now()}-${index}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNext = () => {
    if (previewIdx === null || images.length === 0) return;
    setPreviewIdx((previewIdx + 1) % images.length);
    handleResetZoom();
  };

  const handlePrev = () => {
    if (previewIdx === null || images.length === 0) return;
    setPreviewIdx((previewIdx - 1 + images.length) % images.length);
    handleResetZoom();
  };

  const handleZoomIn = () => setZoomScale(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => {
    setZoomScale(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setZoomOffset({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoomScale(1);
    setZoomOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - zoomOffset.x, y: e.clientY - zoomOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomScale > 1) {
      setZoomOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (previewIdx === null) return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') setPreviewIdx(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIdx, images.length]);

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl border border-neutral-200 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-4">API Key Required</h2>
          <p className="text-neutral-500 mb-8">
            Nano Banana 2 requires a paid API key from a Google Cloud project. 
            Please select your key to continue.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-neutral-900 text-white py-4 rounded-xl font-semibold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
          >
            Select API Key
          </button>
        </motion.div>
      </div>
    );
  }

  if (hasKey === null) return null;

  return (
    <div className="min-h-screen bg-[#F5F5DC] text-neutral-900 font-sans selection:bg-yellow-200 relative overflow-hidden">
      {/* Background Pixel Trail */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <PixelTrail
          pixelSize={screenSize.lessThan('md') ? 48 : 80}
          fadeDuration={0}
          delay={1200}
          pixelClassName="rounded-full bg-[#ffa04f]"
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-12 md:py-16">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#4CAF50] text-white mb-6 shadow-lg rotate-3">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-[#5D4037]">
            <TextScramble duration={1.2} speed={0.03}>
              Orugas Design Studio
            </TextScramble>
          </h1>
          <p className="text-[#795548] text-lg max-w-md mx-auto">
            Professional image generation with Gemini 3.1
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Controls Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-[2rem] shadow-md border border-[#D7CCC8] overflow-hidden">
              <div className="flex border-b border-[#EFEBE9]">
                <button 
                  onClick={() => setActiveTab('basic')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'basic' ? 'bg-[#4CAF50] text-white' : 'text-[#8D6E63] hover:bg-[#FDF5E6]'}`}
                >
                  <Sliders className="w-4 h-4" />
                  Basic
                </button>
                <button 
                  onClick={() => setActiveTab('advanced')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'advanced' ? 'bg-[#4CAF50] text-white' : 'text-[#8D6E63] hover:bg-[#FDF5E6]'}`}
                >
                  <Settings2 className="w-4 h-4" />
                  Advanced
                </button>
                <button 
                  onClick={() => setActiveTab('system')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'system' ? 'bg-[#4CAF50] text-white' : 'text-[#8D6E63] hover:bg-[#FDF5E6]'}`}
                >
                  <Zap className="w-4 h-4" />
                  System
                </button>
              </div>

              <div className="p-6 space-y-8">
                {activeTab === 'basic' ? (
                  <>
                    {/* Model Selection */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-[#8D6E63] uppercase tracking-widest">Model</label>
                      <div className="grid grid-cols-1 gap-2">
                        <button 
                          onClick={() => setModel('gemini-3.1-flash-image-preview')}
                          className={`py-3 px-4 rounded-xl text-xs font-bold border-2 text-left transition-all ${model === 'gemini-3.1-flash-image-preview' ? 'bg-[#FFF9C4] border-[#FBC02D] text-[#F57F17]' : 'bg-white border-[#EFEBE9] text-[#8D6E63]'}`}
                        >
                          <div className="flex justify-between items-center">
                            <span>Nano Banana 2 (Flash)</span>
                            {model === 'gemini-3.1-flash-image-preview' && <Zap className="w-3 h-3" />}
                          </div>
                          <p className="text-[10px] opacity-60 mt-1">Fast, efficient, high-volume</p>
                        </button>
                        <button 
                          onClick={() => setModel('gemini-3-pro-image-preview')}
                          className={`py-3 px-4 rounded-xl text-xs font-bold border-2 text-left transition-all ${model === 'gemini-3-pro-image-preview' ? 'bg-[#FFF9C4] border-[#FBC02D] text-[#F57F17]' : 'bg-white border-[#EFEBE9] text-[#8D6E63]'}`}
                        >
                          <div className="flex justify-between items-center">
                            <span>Nano Banana Pro</span>
                            {model === 'gemini-3-pro-image-preview' && <Sparkles className="w-3 h-3" />}
                          </div>
                          <p className="text-[10px] opacity-60 mt-1">High fidelity, complex reasoning</p>
                        </button>
                        <button 
                          onClick={() => setModel('imagen-4.0-generate-001')}
                          className={`py-3 px-4 rounded-xl text-xs font-bold border-2 text-left transition-all ${model === 'imagen-4.0-generate-001' ? 'bg-[#FFF9C4] border-[#FBC02D] text-[#F57F17]' : 'bg-white border-[#EFEBE9] text-[#8D6E63]'}`}
                        >
                          <div className="flex justify-between items-center">
                            <span>Imagen 4</span>
                            {model === 'imagen-4.0-generate-001' && <ImageIcon className="w-3 h-3" />}
                          </div>
                          <p className="text-[10px] opacity-60 mt-1">Photorealistic, high quality</p>
                        </button>
                      </div>
                    </div>
                    {/* Image Count Slider - Always visible */}
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-[#8D6E63] uppercase tracking-widest flex items-center gap-2">
                          <Layout className="w-3 h-3" />
                          Batch Size: {imageCount}
                        </label>
                      </div>
                      <input 
                        type="range" min="1" max="6" step="1"
                        value={imageCount}
                        onChange={(e) => setImageCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-[#EFEBE9] rounded-lg appearance-none cursor-pointer accent-[#4CAF50]"
                      />
                    </motion.div>

                    {/* Aspect Ratio Slider */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-[#8D6E63] uppercase tracking-widest flex items-center gap-2">
                          <Maximize className="w-3 h-3" />
                          AR: {ASPECT_RATIOS[arIndex]}
                        </label>
                      </div>
                      <input 
                        type="range" min="0" max={ASPECT_RATIOS.length - 1} step="1"
                        value={arIndex}
                        onChange={(e) => setArIndex(parseInt(e.target.value))}
                        className="w-full h-2 bg-[#EFEBE9] rounded-lg appearance-none cursor-pointer accent-[#4CAF50]"
                      />
                    </div>

                    {/* Resolution Slider */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-[#8D6E63] uppercase tracking-widest flex items-center gap-2">
                          <Zap className="w-3 h-3" />
                          Res: {RESOLUTIONS[resIndex]}
                        </label>
                      </div>
                      <input 
                        type="range" min="0" max={RESOLUTIONS.length - 1} step="1"
                        value={resIndex}
                        onChange={(e) => setResIndex(parseInt(e.target.value))}
                        className="w-full h-2 bg-[#EFEBE9] rounded-lg appearance-none cursor-pointer accent-[#4CAF50]"
                      />
                    </div>

                    {/* Mode Radio Buttons */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-[#8D6E63] uppercase tracking-widest">Generation Mode</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => setMode('normal')}
                          className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${mode === 'normal' ? 'bg-[#FFF9C4] border-[#FBC02D] text-[#F57F17]' : 'bg-white border-[#EFEBE9] text-[#8D6E63]'}`}
                        >
                          Normal
                        </button>
                        <button 
                          onClick={() => {
                            setMode('batch');
                            if (imageCount < 2) setImageCount(4);
                          }}
                          className={`py-3 rounded-xl text-sm font-bold border-2 transition-all flex flex-col items-center justify-center gap-1 ${mode === 'batch' ? 'bg-[#FFF9C4] border-[#FBC02D] text-[#F57F17]' : 'bg-white border-[#EFEBE9] text-[#8D6E63]'}`}
                        >
                          <span>Batch</span>
                          <span className="text-[10px] opacity-70 font-medium">50% OFF</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : activeTab === 'advanced' ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="camera" className="text-[10px] font-black text-[#8D6E63] uppercase flex items-center gap-1">
                          <Camera className="w-3 h-3" /> Camera Type
                        </Label>
                        <button 
                          onClick={() => handleSuggest('camera')}
                          disabled={suggesting === 'camera' || !prompt.trim()}
                          className="text-[10px] font-bold text-[#4CAF50] hover:underline disabled:opacity-50 flex items-center gap-1"
                        >
                          {suggesting === 'camera' ? <Loader2 className="w-2 h-2 animate-spin" /> : <Sparkles className="w-2 h-2" />}
                          AI
                        </button>
                      </div>
                      <Input 
                        id="camera"
                        type="text" placeholder="e.g. DSLR, Leica, GoPro"
                        value={advanced.camera}
                        onChange={(e) => setAdvanced({...advanced, camera: e.target.value})}
                        className="w-full bg-[#FDF5E6] border-[#D7CCC8] rounded-xl p-3 text-sm outline-none focus-visible:ring-[#4CAF50] focus-visible:ring-offset-0"
                      />
                      {advanced.camera && (
                        <p className="text-[10px] text-teal-600 font-bold">Looks good!</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="angle" className="text-[10px] font-black text-[#8D6E63] uppercase flex items-center gap-1">
                          <Maximize className="w-3 h-3" /> Angle
                        </Label>
                        <button 
                          onClick={() => handleSuggest('angle')}
                          disabled={suggesting === 'angle' || !prompt.trim()}
                          className="text-[10px] font-bold text-[#4CAF50] hover:underline disabled:opacity-50 flex items-center gap-1"
                        >
                          {suggesting === 'angle' ? <Loader2 className="w-2 h-2 animate-spin" /> : <Sparkles className="w-2 h-2" />}
                          AI
                        </button>
                      </div>
                      <Input 
                        id="angle"
                        type="text" placeholder="e.g. Low angle, Bird's eye"
                        value={advanced.angle}
                        onChange={(e) => setAdvanced({...advanced, angle: e.target.value})}
                        className="w-full bg-[#FDF5E6] border-[#D7CCC8] rounded-xl p-3 text-sm outline-none focus-visible:ring-[#4CAF50] focus-visible:ring-offset-0"
                      />
                      {advanced.angle && (
                        <p className="text-[10px] text-teal-600 font-bold">Looks good!</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="lighting" className="text-[10px] font-black text-[#8D6E63] uppercase flex items-center gap-1">
                          <Sun className="w-3 h-3" /> Lighting
                        </Label>
                        <button 
                          onClick={() => handleSuggest('lighting')}
                          disabled={suggesting === 'lighting' || !prompt.trim()}
                          className="text-[10px] font-bold text-[#4CAF50] hover:underline disabled:opacity-50 flex items-center gap-1"
                        >
                          {suggesting === 'lighting' ? <Loader2 className="w-2 h-2 animate-spin" /> : <Sparkles className="w-2 h-2" />}
                          AI
                        </button>
                      </div>
                      <Input 
                        id="lighting"
                        type="text" placeholder="e.g. Cinematic, Golden hour"
                        value={advanced.lighting}
                        onChange={(e) => setAdvanced({...advanced, lighting: e.target.value})}
                        className="w-full bg-[#FDF5E6] border-[#D7CCC8] rounded-xl p-3 text-sm outline-none focus-visible:ring-[#4CAF50] focus-visible:ring-offset-0"
                      />
                      {advanced.lighting && (
                        <p className="text-[10px] text-teal-600 font-bold">Looks good!</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="filter" className="text-[10px] font-black text-[#8D6E63] uppercase flex items-center gap-1">
                          <Palette className="w-3 h-3" /> Filter
                        </Label>
                        <button 
                          onClick={() => handleSuggest('filter')}
                          disabled={suggesting === 'filter' || !prompt.trim()}
                          className="text-[10px] font-bold text-[#4CAF50] hover:underline disabled:opacity-50 flex items-center gap-1"
                        >
                          {suggesting === 'filter' ? <Loader2 className="w-2 h-2 animate-spin" /> : <Sparkles className="w-2 h-2" />}
                          AI
                        </button>
                      </div>
                      <Input 
                        id="filter"
                        type="text" placeholder="e.g. Vintage, Cyberpunk"
                        value={advanced.filter}
                        onChange={(e) => setAdvanced({...advanced, filter: e.target.value})}
                        className="w-full bg-[#FDF5E6] border-[#D7CCC8] rounded-xl p-3 text-sm outline-none focus-visible:ring-[#4CAF50] focus-visible:ring-offset-0"
                      />
                      {advanced.filter && (
                        <p className="text-[10px] text-teal-600 font-bold">Looks good!</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="style" className="text-[10px] font-black text-[#8D6E63] uppercase flex items-center gap-1">
                          <Brush className="w-3 h-3" /> Illustration Style
                        </Label>
                        <button 
                          onClick={() => handleSuggest('style')}
                          disabled={suggesting === 'style' || !prompt.trim()}
                          className="text-[10px] font-bold text-[#4CAF50] hover:underline disabled:opacity-50 flex items-center gap-1"
                        >
                          {suggesting === 'style' ? <Loader2 className="w-2 h-2 animate-spin" /> : <Sparkles className="w-2 h-2" />}
                          AI
                        </button>
                      </div>
                      <Input 
                        id="style"
                        type="text" placeholder="e.g. Oil painting, 3D Render"
                        value={advanced.style}
                        onChange={(e) => setAdvanced({...advanced, style: e.target.value})}
                        className="w-full bg-[#FDF5E6] border-[#D7CCC8] rounded-xl p-3 text-sm outline-none focus-visible:ring-[#4CAF50] focus-visible:ring-offset-0"
                      />
                      {advanced.style && (
                        <p className="text-[10px] text-teal-600 font-bold">Looks good!</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Search Grounding */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-[#8D6E63] uppercase tracking-widest flex items-center gap-2">
                        <LinkIcon className="w-3 h-3" /> Search Grounding
                      </label>
                      <div className="space-y-2">
                        <button 
                          onClick={() => setUseSearch(!useSearch)}
                          className={`w-full py-3 px-4 rounded-xl text-xs font-bold border-2 text-left transition-all ${useSearch ? 'bg-[#E8F5E9] border-[#4CAF50] text-[#2E7D32]' : 'bg-white border-[#EFEBE9] text-[#8D6E63]'}`}
                        >
                          Web Search Grounding
                        </button>
                        {useSearch && model === 'gemini-3.1-flash-image-preview' && (
                          <button 
                            onClick={() => setUseImageSearch(!useImageSearch)}
                            className={`w-full py-3 px-4 rounded-xl text-xs font-bold border-2 text-left transition-all ${useImageSearch ? 'bg-[#E8F5E9] border-[#4CAF50] text-[#2E7D32]' : 'bg-white border-[#EFEBE9] text-[#8D6E63]'}`}
                          >
                            Image Search Grounding
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Thinking Config */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-[#8D6E63] uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Thinking Config
                      </label>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setThinkingLevel('Minimal')}
                            className={`py-2 rounded-xl text-[10px] font-bold border-2 transition-all ${thinkingLevel === 'Minimal' ? 'bg-[#FFF9C4] border-[#FBC02D] text-[#F57F17]' : 'bg-white border-[#EFEBE9] text-[#8D6E63]'}`}
                          >
                            Minimal
                          </button>
                          <button 
                            onClick={() => setThinkingLevel('High')}
                            className={`py-2 rounded-xl text-[10px] font-bold border-2 transition-all ${thinkingLevel === 'High' ? 'bg-[#FFF9C4] border-[#FBC02D] text-[#F57F17]' : 'bg-white border-[#EFEBE9] text-[#8D6E63]'}`}
                          >
                            High
                          </button>
                        </div>
                        <button 
                          onClick={() => setShowThoughts(!showThoughts)}
                          className={`w-full py-3 px-4 rounded-xl text-xs font-bold border-2 text-left transition-all ${showThoughts ? 'bg-[#E8F5E9] border-[#4CAF50] text-[#2E7D32]' : 'bg-white border-[#EFEBE9] text-[#8D6E63]'}`}
                        >
                          Include Thoughts in Result
                        </button>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setImages([]);
                        setThoughts([]);
                        setError(null);
                      }}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-red-50 text-red-600 border-2 border-red-100 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Clear Gallery
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[2.5rem] shadow-md border border-[#D7CCC8] p-6 space-y-6">
              
              {/* Base Image for Editing */}
              {baseImage && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-yellow-50 border-2 border-yellow-200 rounded-3xl p-4 flex items-center gap-4"
                >
                  <div className="relative">
                    <img src={baseImage} className="w-16 h-16 object-cover rounded-xl border border-yellow-300" />
                    <button 
                      onClick={() => setBaseImage(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-black text-yellow-700 uppercase tracking-widest">Editing Mode</p>
                    <p className="text-[10px] text-yellow-600">The prompt below will be used to modify this image.</p>
                  </div>
                </motion.div>
              )}

              {/* Reference Images Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-black text-[#8D6E63] uppercase tracking-widest flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Reference Images ({referenceImages.length}/14)
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleUrlUpload}
                      className="p-2 bg-[#FDF5E6] border border-[#D7CCC8] rounded-xl hover:bg-[#EFEBE9] transition-colors"
                      title="Add from URL"
                    >
                      <LinkIcon className="w-4 h-4 text-[#8D6E63]" />
                    </button>
                    <label className="p-2 bg-[#FDF5E6] border border-[#D7CCC8] rounded-xl hover:bg-[#EFEBE9] transition-colors cursor-pointer" title="Upload from computer">
                      <Upload className="w-4 h-4 text-[#8D6E63]" />
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide min-h-[100px]">
                  {referenceImages.length === 0 && (
                    <div className="flex-1 border-2 border-dashed border-[#D7CCC8] rounded-2xl p-6 flex flex-col items-center justify-center text-[#8D6E63] opacity-60">
                      <Clipboard className="w-6 h-6 mb-2" />
                      <p className="text-[10px] font-bold">Paste (Ctrl+V) or Upload</p>
                    </div>
                  )}
                  {referenceImages.map((img, idx) => (
                    <div key={idx} className="relative flex-shrink-0 group">
                      <img 
                        src={img} 
                        alt={`Ref ${idx}`} 
                        className="w-20 h-20 object-cover rounded-2xl border-2 border-[#D7CCC8] group-hover:border-[#4CAF50] transition-all"
                      />
                      <button 
                        onClick={() => removeReferenceImage(idx)}
                        className="absolute -top-2 -right-2 bg-[#FF5252] text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {referenceImages.length > 0 && referenceImages.length < 14 && (
                    <label className="w-20 h-20 flex-shrink-0 border-2 border-dashed border-[#D7CCC8] rounded-2xl flex items-center justify-center text-[#8D6E63] hover:border-[#4CAF50] hover:text-[#4CAF50] transition-all cursor-pointer">
                      <Plus className="w-5 h-5" />
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                    </label>
                  )}
                </div>
              </div>

              <div className="h-px bg-[#EFEBE9]" />

              <div className="relative space-y-2">
                <Label htmlFor="prompt" className="text-xs font-black text-[#8D6E63] uppercase tracking-widest">Prompt</Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your vision..."
                  aria-invalid={prompt.length > 0 && prompt.length < 10}
                  className="w-full min-h-[160px] p-4 text-xl bg-transparent border-none outline-none resize-none placeholder:text-[#D7CCC8] text-[#5D4037] focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {prompt.length > 0 && prompt.length < 10 ? (
                  <p className="text-xs text-red-500 font-bold" role="alert">
                    Prompt must be at least 10 characters.
                  </p>
                ) : (
                  prompt.length >= 10 && (
                    <p className="text-xs text-teal-600 font-bold">
                      Looks good!
                    </p>
                  )
                )}
                <div className="flex justify-between items-center mt-4">
                  <button
                    onClick={handleRewriteJson}
                    disabled={rewriting || !prompt.trim()}
                    className="flex items-center gap-2 text-[#4CAF50] hover:bg-[#E8F5E9] px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    {rewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code className="w-4 h-4" />}
                    Rewrite as JSON
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={!prompt.trim()}
                    className="flex items-center gap-3 bg-[#4CAF50] hover:bg-[#43A047] disabled:bg-[#C8E6C9] disabled:text-[#81C784] text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-[#4CAF50]/20 transition-all active:scale-95"
                  >
                    {pendingCount > 0 ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating ({pendingCount})...
                      </>
                    ) : (
                      <>
                        {mode === 'batch' ? `Generate Batch (${imageCount})` : 'Generate Image'}
                        <Sparkles className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 text-red-600 px-6 py-4 rounded-2xl text-sm font-bold border border-red-100"
              >
                {error}
              </motion.div>
            )}

            {/* Results Grid */}
            <div className={`grid gap-4 ${images.length + pendingCount + thoughts.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <AnimatePresence mode="popLayout">
                {Array.from({ length: pendingCount }).map((_, i) => (
                  <motion.div 
                    key={`pending-${i}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="h-[300px] bg-white rounded-[2rem] border-2 border-dashed border-[#D7CCC8] flex flex-col items-center justify-center overflow-hidden"
                  >
                    <div className="w-12 h-12 border-4 border-[#EFEBE9] border-t-[#4CAF50] rounded-full animate-spin mb-4" />
                    <p className="text-[#8D6E63] text-xs font-bold animate-pulse">Brewing...</p>
                  </motion.div>
                ))}

                {showThoughts && thoughts.map((img, idx) => (
                  <motion.div
                    key={`thought-${idx}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative group bg-neutral-100 rounded-[2rem] overflow-hidden shadow-sm border border-[#D7CCC8] opacity-60"
                  >
                    <img src={img} alt="Thought" className="w-full h-auto aspect-square object-cover grayscale" />
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-[8px] px-2 py-1 rounded-full uppercase font-bold">Thought</div>
                  </motion.div>
                ))}

                {images.length > 0 ? (
                  images.map((img, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="relative group bg-white rounded-[2rem] overflow-hidden shadow-sm border border-[#D7CCC8] cursor-zoom-in"
                      onClick={() => setPreviewIdx(idx)}
                    >
                      <img 
                        src={img} 
                        alt={`Result ${idx}`} 
                        className="w-full h-auto object-cover aspect-square" 
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-white text-neutral-900 p-4 rounded-2xl shadow-xl hover:scale-110 transition-transform">
                          <Maximize className="w-6 h-6" />
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : pendingCount === 0 && (
                  <div className="col-span-full h-[400px] bg-white rounded-[2.5rem] border-2 border-dashed border-[#D7CCC8] flex flex-col items-center justify-center text-center p-12">
                    <div className="w-20 h-20 bg-[#FDF5E6] rounded-3xl flex items-center justify-center mb-6">
                      <ImageIcon className="w-10 h-10 text-[#D7CCC8]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#5D4037] mb-2">Ready to create?</h3>
                    <p className="text-[#8D6E63]">Enter a prompt and adjust the settings to start generating.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Gallery Overlay */}
      <AnimatePresence>
        {previewIdx !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
            onClick={() => {
              setPreviewIdx(null);
              handleResetZoom();
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-[76vw] h-[76vh] flex flex-col bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image Viewport */}
              <div 
                className={`relative flex-1 bg-neutral-50 flex items-center justify-center overflow-hidden group/gallery ${zoomScale > 1 ? 'cursor-move' : 'cursor-default'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <motion.img 
                  src={images[previewIdx]} 
                  alt="Preview" 
                  animate={{ 
                    scale: zoomScale,
                    x: zoomOffset.x,
                    y: zoomOffset.y
                  }}
                  transition={isDragging ? { type: 'just' } : { type: 'spring', stiffness: 300, damping: 30 }}
                  className="max-w-full max-h-full object-contain p-4 select-none pointer-events-none"
                />
                
                {/* Navigation Controls */}
                <button 
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                  className="absolute left-6 p-5 bg-white/10 hover:bg-white/30 backdrop-blur-xl rounded-full text-white transition-all border border-white/20 opacity-0 group-hover/gallery:opacity-100 z-10"
                >
                  <ChevronLeft className="w-10 h-10" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="absolute right-6 p-5 bg-white/10 hover:bg-white/30 backdrop-blur-xl rounded-full text-white transition-all border border-white/20 opacity-0 group-hover/gallery:opacity-100 z-10"
                >
                  <ChevronRight className="w-10 h-10" />
                </button>

                {/* Zoom Controls */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 z-20 opacity-0 group-hover/gallery:opacity-100 transition-opacity">
                  <button onClick={handleZoomOut} className="p-2 hover:bg-white/20 rounded-xl text-white transition-colors">
                    <ZoomOut className="w-5 h-5" />
                  </button>
                  <span className="text-white text-xs font-bold min-w-[3rem] text-center">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button onClick={handleZoomIn} className="p-2 hover:bg-white/20 rounded-xl text-white transition-colors">
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <div className="w-px h-4 bg-white/20 mx-1" />
                  <button onClick={handleResetZoom} className="p-2 hover:bg-white/20 rounded-xl text-white transition-colors">
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>

                {/* Close Button */}
                <button 
                  onClick={() => {
                    setPreviewIdx(null);
                    handleResetZoom();
                  }}
                  className="absolute top-6 right-6 p-3 bg-black/20 hover:bg-black/40 backdrop-blur-xl rounded-full text-white transition-all border border-white/10 z-20"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Gallery Info & Actions */}
              <div className="p-8 bg-white border-t border-neutral-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-[#5D4037]">Image #{previewIdx + 1} of {images.length}</h3>
                    <p className="text-[#8D6E63] font-medium flex items-center gap-2">
                      <Maximize className="w-4 h-4" /> {ASPECT_RATIOS[arIndex]} • {RESOLUTIONS[resIndex]}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:flex items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={() => {
                        setBaseImage(images[previewIdx]);
                        setPrompt("");
                        setPreviewIdx(null);
                        alert("Selected as base image for editing!");
                      }}
                      className="bg-[#E3F2FD] text-[#1976D2] px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 border border-[#90CAF9] hover:bg-[#BBDEFB] transition-all"
                    >
                      <Brush className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        addReferenceImage(images[previewIdx]);
                        alert("Added to reference images!");
                      }}
                      disabled={referenceImages.length >= 14}
                      className="bg-[#FFF9C4] text-[#F57F17] px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 border border-[#FBC02D] hover:bg-[#FFF59D] transition-all disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      Ref
                    </button>
                    <button
                      onClick={() => handleDownload(images[previewIdx], previewIdx)}
                      className="bg-[#4CAF50] text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#43A047] transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(prompt);
                        alert("Prompt copied!");
                      }}
                      className="bg-[#FDF5E6] text-[#8D6E63] px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 border border-[#D7CCC8] hover:bg-[#EFEBE9] transition-all"
                    >
                      <Clipboard className="w-4 h-4" />
                      Prompt
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

