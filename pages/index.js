import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Loader, X, Zap, Square } from 'lucide-react';
import Head from 'next/head';

export default function CanvasQuizAnalyzer() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const analyzingRef = useRef(false);
  const currentStreamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [error, setError] = useState('');
  const [streamReady, setStreamReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [nativeZoomRange, setNativeZoomRange] = useState(null);

  const startStream = useCallback(async (deviceId = null) => {
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach((t) => t.stop());
      currentStreamRef.current = null;
    }
    setStreamReady(false);

    const constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStreamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.style.transform = '';
      videoRef.current.style.transformOrigin = '';
    }

    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.() || {};
    if (caps.zoom) {
      setNativeZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
    } else {
      setNativeZoomRange(null);
    }

    setStreamReady(true);
    setError('');
    return stream;
  }, []);

  useEffect(() => {
    if (!cameraActive) return;

    const init = async () => {
      try {
        await startStream();
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoDevices);
      } catch {
        setError('Camera access denied. Allow camera and try again.');
        setCameraActive(false);
      }
    };

    init();

    return () => {
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach((t) => t.stop());
        currentStreamRef.current = null;
      }
      setStreamReady(false);
    };
  }, [cameraActive, startStream]);

  const changeZoom = useCallback(
    async (newZoom) => {
      if (!videoRef.current?.srcObject) return;

      const track = videoRef.current.srcObject.getVideoTracks()[0];

      if (nativeZoomRange && newZoom >= nativeZoomRange.min && newZoom <= nativeZoomRange.max) {
        try {
          await track.applyConstraints({ advanced: [{ zoom: newZoom }] });
          videoRef.current.style.transform = '';
          setZoomLevel(newZoom);
          return;
        } catch {
          // fall through
        }
      }

      if (newZoom === 0.5 && availableDevices.length > 1) {
        const ultrawide = availableDevices.find((d) => {
          const label = d.label.toLowerCase();
          return label.includes('ultra') || label.includes('wide') || label.includes('0.5') || label.includes('back, 0');
        });
        if (ultrawide) {
          try {
            await startStream(ultrawide.deviceId);
            setZoomLevel(0.5);
            return;
          } catch {
            // fall through
          }
        }
      }

      if (newZoom === 1) {
        try {
          await startStream();
          setZoomLevel(1);
          return;
        } catch {
          // fall through
        }
      }

      if (videoRef.current) {
        videoRef.current.style.transform = newZoom !== 1 ? `scale(${newZoom})` : '';
        videoRef.current.style.transformOrigin = 'center center';
      }
      setZoomLevel(newZoom);
    },
    [nativeZoomRange, availableDevices, startStream]
  );

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  };

  const runAnalysis = useCallback(async () => {
    if (analyzingRef.current) return;
    const imageData = captureImage();
    if (!imageData) return;

    analyzingRef.current = true;
    setAnalyzing(true);
    setError('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Analysis failed');
      } else if (data.questions && data.questions.length > 0) {
        const primary = data.questions[0];
        setCurrentAnswer({
          letter: primary.suggestedAnswer,
          reasoning: primary.reasoning,
          questionText: primary.questionText,
          all: data.questions.map((q) => ({ num: q.questionNumber, letter: q.suggestedAnswer })),
        });
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    if (!autoMode || !streamReady) return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        await runAnalysis();
        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    loop();
    return () => { cancelled = true; };
  }, [autoMode, streamReady, runAnalysis]);

  const stopCamera = () => {
    setAutoMode(false);
    setCameraActive(false);
    setCurrentAnswer(null);
    setError('');
    setZoomLevel(1);
  };

  if (!cameraActive) {
    return (
      <>
        <Head>
          <title>Canvas Quiz AI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex flex-col items-center justify-center px-6">
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 text-center w-full max-w-sm">
            <div className="inline-block p-5 bg-blue-500/20 rounded-3xl mb-6">
              <Camera className="w-14 h-14 text-blue-400" />
            </div>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Canvas Quiz AI</h1>
            <p className="text-slate-400 mb-8 text-sm">
              Point your camera at a quiz — answers appear instantly on screen.
            </p>
            {error && (
              <div className="mb-6 bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-3">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            <button
              onClick={() => setCameraActive(true)}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-bold rounded-2xl transition-all hover:scale-105 flex items-center justify-center gap-2 text-lg shadow-lg shadow-blue-500/25"
            >
              <Camera className="w-5 h-5" />
              Open Camera
            </button>
            <p className="mt-5 text-xs text-slate-600">
              Requires camera permission · Works on any phone
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Canvas Quiz AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-black flex flex-col">

        {/* Camera section */}
        <div className="relative flex-1" style={{ minHeight: '40vh' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ display: 'block' }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3">
            <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-xl flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${autoMode ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-white text-xs font-semibold">
                {autoMode ? (analyzing ? 'Scanning…' : 'Auto') : 'Standby'}
              </span>
              {analyzing && <Loader className="w-3 h-3 text-blue-400 animate-spin" />}
            </div>

            {/* Zoom + X */}
            <div className="flex items-center gap-2">
              {[0.5, 1, 2].map((z) => (
                <button
                  key={z}
                  onClick={() => changeZoom(z)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    zoomLevel === z
                      ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/40'
                      : 'bg-black/60 backdrop-blur-md text-white/80'
                  }`}
                >
                  {z}x
                </button>
              ))}
              <button
                onClick={stopCamera}
                className="bg-black/60 backdrop-blur-md text-white p-2 rounded-xl ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Start / Stop */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <button
              onClick={() => setAutoMode((prev) => !prev)}
              disabled={!streamReady}
              className={`w-full py-3 font-bold text-base rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 ${
                autoMode
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-blue-500/30'
              }`}
            >
              {autoMode ? (
                <><Square className="w-4 h-4" />Stop</>
              ) : (
                <><Zap className="w-4 h-4" />Start Analyzing</>
              )}
            </button>
          </div>
        </div>

        {/* Answer panel */}
        <div className="bg-slate-900 overflow-y-auto" style={{ maxHeight: '55vh' }}>
          {currentAnswer ? (
            <div className="p-4">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/30">
                  <span className="text-white text-3xl font-black">{currentAnswer.letter}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-0.5">Correct Answer</p>
                  <p className="text-white/70 text-sm leading-relaxed">{currentAnswer.questionText}</p>
                </div>
              </div>
              <p className="text-white/60 text-sm leading-relaxed border-t border-white/10 pt-3">
                {currentAnswer.reasoning}
              </p>
              {currentAnswer.all && currentAnswer.all.length > 1 && (
                <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-white/10">
                  {currentAnswer.all.map((a) => (
                    <span key={a.num} className="bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                      Q{a.num}: {a.letter}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center">
              {error ? (
                <p className="text-red-400 text-sm">{error}</p>
              ) : autoMode && analyzing ? (
                <p className="text-slate-400 text-sm">Analyzing…</p>
              ) : autoMode ? (
                <p className="text-slate-500 text-sm">Point camera at a question…</p>
              ) : (
                <p className="text-slate-600 text-sm">Press Start Analyzing to begin</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
