'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { 
  Upload, 
  Settings2, 
  FileVideo, 
  Download, 
  Loader2, 
  CheckCircle2, 
  RefreshCw,
  Video,
  FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const QUALITY_SETTINGS = {
  high: { label: 'High Quality', crf: '24', estimateRatio: 0.7, description: 'Minimal compression, best quality' },
  medium: { label: 'Balanced', crf: '28', estimateRatio: 0.45, description: 'Good quality, reasonable size' },
  low: { label: 'Max Compression', crf: '32', estimateRatio: 0.2, description: 'Smallest file, noticeable quality loss' },
};

type QualityLevel = keyof typeof QUALITY_SETTINGS;

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function VideoCompressor() {
  const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<QualityLevel>('medium');
  const [isDragging, setIsDragging] = useState(false);
  
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFFmpeg = async () => {
    try {
      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }
      const ffmpeg = ffmpegRef.current;
      
      ffmpeg.on('progress', ({ progress }) => {
        // FFmpeg progress can sometimes be slightly out of bounds, clamp it
        const p = Math.max(0, Math.min(100, Math.round(progress * 100)));
        setProgress(p);
      });
      
      ffmpeg.on('log', ({ message }) => {
        console.log(message);
        if (message.includes('Compression')) {
          setStatusText('Compressing...');
        }
      });

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      return true;
    } catch (error) {
      console.error('Error loading FFmpeg:', error);
      return false;
    }
  };

  useEffect(() => {
    loadFFmpeg().then((success) => {
      if (success) {
        setIsFfmpegLoaded(true);
      } else {
        setLoadError('Failed to load the compression engine. Please refresh and try again.');
      }
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelection = (selectedFile: File) => {
    setFile(selectedFile);
    setOutputUrl(null);
    setOutputSize(null);
    setProgress(0);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        handleFileSelection(droppedFile);
      } else {
        alert('Please drop a valid video file.');
      }
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const compressVideo = async () => {
    if (!file || !ffmpegRef.current) return;
    
    setIsCompressing(true);
    setProgress(0);
    setStatusText('Preparing file...');
    
    try {
      const ffmpeg = ffmpegRef.current;
      
      const inputName = `input_${Date.now()}.${file.name.split('.').pop() || 'mp4'}`;
      const outputName = `output_${Date.now()}.mp4`;
      
      // Write file to FFmpeg WASM FS
      ffmpeg.writeFile(inputName, await fetchFile(file));
      
      setStatusText('Compressing video... This may take a while.');
      
      const crf = QUALITY_SETTINGS[quality].crf;
      
      // Run compression
      // Using veryfast preset to speed up WASM execution since it's client-side
      await ffmpeg.exec([
        '-i', inputName,
        '-vcodec', 'libx264',
        '-crf', crf,
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-b:a', '128k',
        outputName
      ]);
      
      setStatusText('Finalizing...');
      
      // Read output
      const data = await ffmpeg.readFile(outputName);
      
      // Create blob
      const blob = new Blob([data as any], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      setOutputSize(blob.size);
      setOutputUrl(url);
      
      // Cleanup WASM FS
      ffmpeg.deleteFile(inputName);
      ffmpeg.deleteFile(outputName);
      
    } catch (error) {
      console.error('Compression error:', error);
      alert('An error occurred during compression.');
    } finally {
      setIsCompressing(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setOutputUrl(null);
    setOutputSize(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-slate-200 font-sans p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Header */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mb-2">
            <Video className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white uppercase">
            Offline Video Compressor
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto text-sm">
            Compress your videos entirely in your browser. No server uploads, total privacy, and fully offline.
          </p>
        </header>

        {loadError && (
          <div className="p-4 bg-red-500/10 text-red-400 rounded-2xl text-center border border-red-500/20">
            {loadError}
          </div>
        )}

        <div className="bg-[#111112] rounded-3xl shadow-xl shadow-black/50 border border-white/10 p-6 md:p-10">
          <AnimatePresence mode="wait">
            
            {!file && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-colors ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-500/10' 
                    : 'border-white/10 bg-white/5 hover:border-indigo-500/50 hover:bg-white/10'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  ref={fileInputRef}
                  disabled={!isFfmpegLoaded}
                />
                
                {!isFfmpegLoaded ? (
                  <div className="flex flex-col items-center text-indigo-400 space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin" />
                    <p className="font-mono text-sm tracking-widest uppercase">Initializing Engine...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center space-y-4 pointer-events-none">
                    <div className="w-16 h-16 bg-white/5 border border-white/10 text-slate-300 rounded-2xl flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-white">
                        Drag and drop your video here
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        MP4, MOV, AVI up to 2GB
                      </p>
                    </div>
                    <button className="mt-6 px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition-colors pointer-events-auto shadow-lg shadow-indigo-900/20" onClick={() => fileInputRef.current?.click()}>
                      Select File
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {file && !outputUrl && !isCompressing && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* File Details */}
                <div className="flex items-center p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                    <FileVideo className="w-6 h-6" />
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                  </div>
                  <button 
                    onClick={resetState}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Change file"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>

                {/* Settings */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-slate-300">
                    <Settings2 className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Optimization Preset</h3>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    {(Object.keys(QUALITY_SETTINGS) as QualityLevel[]).map((q) => {
                      const setting = QUALITY_SETTINGS[q];
                      const isSelected = quality === q;
                      return (
                        <button
                          key={q}
                          onClick={() => setQuality(q)}
                          className={`relative p-5 text-left rounded-xl border transition-all ${
                            isSelected 
                              ? 'border-indigo-500 bg-indigo-500/10' 
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <p className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                              {setting.label}
                            </p>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                          </div>
                          <p className={`text-[10px] mt-1 ${isSelected ? 'text-indigo-300' : 'text-slate-500'}`}>
                            {setting.description}
                          </p>
                          <div className={`mt-4 text-xs font-mono tracking-tighter ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`}>
                            Est. ~{formatBytes(file.size * setting.estimateRatio)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action */}
                <button
                  onClick={compressVideo}
                  disabled={!isFfmpegLoaded}
                  className="w-full py-5 bg-indigo-600 text-white font-bold tracking-wide rounded-2xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm shadow-xl shadow-indigo-900/20 flex items-center justify-center gap-3 uppercase"
                >
                  <span>Initialize Encoding</span>
                  <Video className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {isCompressing && (
              <motion.div
                key="compressing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center text-center space-y-8"
              >
                <div className="relative">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="76"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      className="text-white/5"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="76"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      strokeDasharray="477.5"
                      strokeDashoffset={477.5 - (477.5 * progress) / 100}
                      className="text-indigo-500 transition-all duration-300 ease-out drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-bold text-white">{progress}%</span>
                    <span className="text-[10px] uppercase tracking-widest text-indigo-400 mt-1">Processing</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-mono text-indigo-300 uppercase tracking-tight">{statusText || "Encoding..."}</h3>
                  <p className="text-slate-500 text-xs tracking-widest uppercase max-w-xs mx-auto">
                    Local WASM Engine Active
                  </p>
                </div>
              </motion.div>
            )}

            {outputUrl && file && outputSize && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
                    <FileCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Encoding Complete</h3>
                    <p className="text-slate-400 mt-1 text-sm">Successfully reduced your video size.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Original Size</p>
                    <p className="text-2xl font-bold text-white font-mono">{formatBytes(file.size)}</p>
                  </div>
                  <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-1">New Size</p>
                    <p className="text-2xl font-bold text-emerald-400 font-mono">{formatBytes(outputSize)}</p>
                  </div>
                </div>
                
                <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 text-indigo-300 rounded-2xl text-center font-medium text-sm">
                  You saved <span className="text-indigo-400 font-bold">{formatBytes(file.size - outputSize)}</span> 
                  <span className="text-slate-500 ml-2">({Math.round(((file.size - outputSize) / file.size) * 100)}% reduction)</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <a
                    href={outputUrl}
                    download={`compressed_${file.name}`}
                    className="flex-1 flex items-center justify-center space-x-2 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20 uppercase text-sm tracking-wide"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download Output</span>
                  </a>
                  <button
                    onClick={resetState}
                    className="flex-1 py-4 bg-white/5 text-slate-300 font-bold rounded-xl border border-white/10 hover:bg-white/10 hover:text-white transition-colors uppercase text-sm tracking-wide"
                  >
                    Process Another
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
