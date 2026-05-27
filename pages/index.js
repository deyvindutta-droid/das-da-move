import { useState, useRef, useEffect } from 'react';
import { Camera, Loader, X, Copy, Zap } from 'lucide-react';
import Head from 'next/head';

export default function CanvasQuizAnalyzer() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [streamReady, setStreamReady] = useState(false);

  // Start camera stream when cameraActive flips to true
  useEffect(() => {
    if (!cameraActive) return;

    let stream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamReady(true);
          setError('');
        }
      } catch (err) {
        setError('Camera access denied. Please allow camera access and try again.');
        setCameraActive(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      setStreamReady(false);
    };
  }, [cameraActive]);

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Strip the data:image/jpeg;base64, prefix — send only the raw base64
    const imageData = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

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
        return;
      }

      setAnalysis(data);
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    setAnalysis(null);
    setError('');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // ── Landing screen ──────────────────────────────────────────────────────────
  if (!cameraActive) {
    return (
      <>
        <Head>
          <title>Canvas Quiz Analyzer</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>

        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex flex-col items-center justify-center px-4">
          {/* Ambient blobs */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 text-center max-w-md w-full">
            <div className="mb-8">
              <div className="inline-block p-4 bg-blue-500/20 rounded-2xl mb-4">
                <Camera className="w-12 h-12 text-blue-400" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">Canvas Quiz AI</h1>
              <p className="text-slate-300">
                Point your camera at your screen to analyze questions
              </p>
            </div>

            {error && (
              <div className="mb-4 bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-3">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={() => setCameraActive(true)}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Start Camera
            </button>

            <p className="mt-4 text-xs text-slate-500">
              Make sure your phone camera faces your computer screen
            </p>
          </div>
        </div>
      </>
    );
  }

  // ── Camera + analysis screen ─────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Canvas Quiz AI — Live</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-black flex flex-col">
        {/* Camera feed */}
        <div className="relative flex-1 bg-black overflow-hidden" style={{ minHeight: '40vh' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-4">
            {/* Top bar */}
            <div className="flex items-center justify-between">
              <div className="bg-black/50 backdrop-blur-sm px-3 py-2 rounded-lg">
                <p className="text-white text-sm font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Live
                </p>
              </div>
              <button
                onClick={stopCamera}
                className="bg-red-500/80 hover:bg-red-600 backdrop-blur-sm text-white p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Analyze button */}
            <button
              onClick={captureAndAnalyze}
              disabled={analyzing || !streamReady}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Analyze Questions
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/20 border-t border-red-500/50 px-4 py-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Results panel */}
        {analysis && (
          <div className="bg-slate-900 border-t border-slate-700 overflow-y-auto" style={{ maxHeight: '55vh' }}>
            <div className="p-4 space-y-4">
              {analysis.questions && analysis.questions.length > 0 ? (
                <>
                  <h2 className="text-white font-bold text-lg sticky top-0 bg-slate-900 py-2 z-10">
                    {analysis.questions.length} Question{analysis.questions.length !== 1 ? 's' : ''} Found
                  </h2>

                  {analysis.questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3"
                    >
                      {/* Question text */}
                      <p className="text-slate-300 text-sm leading-relaxed">
                        <span className="font-bold text-blue-400">Q{q.questionNumber}: </span>
                        {q.questionText}
                      </p>

                      {/* Options */}
                      {q.options && q.options.length > 0 && (
                        <div className="space-y-1">
                          {q.options.map((opt, i) => (
                            <div
                              key={i}
                              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                                opt.letter === q.suggestedAnswer
                                  ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                                  : 'bg-slate-700/40 text-slate-400'
                              }`}
                            >
                              <span className="font-bold">{opt.letter})</span> {opt.text}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Answer + reasoning */}
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                        <p className="text-green-400 font-bold text-sm mb-1">
                          ✓ Answer: {q.suggestedAnswer}
                        </p>
                        <p className="text-green-300/80 text-xs leading-relaxed">{q.reasoning}</p>
                      </div>

                      {/* Copy */}
                      <button
                        onClick={() => copyToClipboard(q.suggestedAnswer)}
                        className="w-full py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Copy className="w-3 h-3" />
                        Copy Answer
                      </button>
                    </div>
                  ))}

                  {analysis.summary && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                      <p className="text-slate-400 text-xs">
                        <span className="text-slate-300 font-semibold">Summary: </span>
                        {analysis.summary}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-400 text-center py-6">
                  No questions detected. Try repositioning your camera.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
