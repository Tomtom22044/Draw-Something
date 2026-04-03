import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import './index.css';

const WORDS = {
  easy: [{ w: "כלב", c: 1 }, { w: "חתול", c: 1 }, { w: "בית", c: 1 }, { w: "שמש", c: 1 }, { w: "עץ", c: 1 }, { w: "ים", c: 1 }, { w: "לב", c: 1 }, { w: "פרח", c: 1 }, { w: "דג", c: 1 }, { w: "אש", c: 1 }],
  medium: [{ w: "מכונית", c: 2 }, { w: "שולחן", c: 2 }, { w: "כיסא", c: 2 }, { w: "אופניים", c: 2 }, { w: "מחשב", c: 2 }, { w: "טלפון", c: 2 }, { w: "גיטרה", c: 2 }, { w: "משקפיים", c: 2 }, { w: "בננה", c: 2 }, { w: "ציפור", c: 2 }],
  hard: [{ w: "פיל", c: 3 }, { w: "מסוק", c: 3 }, { w: "טלוויזיה", c: 3 }, { w: "משאית", c: 3 }, { w: "רובוט", c: 3 }, { w: "פיצה", c: 3 }, { w: "דינוזאור", c: 3 }, { w: "מצלמה", c: 3 }, { w: "מטוס", c: 3 }, { w: "מטרייה", c: 3 }]
};

const HEBREW_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת";

function shuffle(array) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

function getRandomLetter() {
  return HEBREW_LETTERS[Math.floor(Math.random() * HEBREW_LETTERS.length)];
}

const COLORS = ['#2D3142', '#FF416C', '#4CAF50', '#2196F3', '#FFC107', '#9C27B0', '#FFFFFF'];

export default function App() {
  const [socket, setSocket] = useState(null);
  const [phase, setPhase] = useState('start');
  const [roomId, setRoomId] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [role, setRole] = useState(null);
  const [score, setScore] = useState(0);
  const [errorObj, setErrorObj] = useState(null);

  const [currentWord, setCurrentWord] = useState(null);
  const [options, setOptions] = useState([]);
  const [drawingData, setDrawingData] = useState(null);
  const [lastWin, setLastWin] = useState({ word: '', points: 0 });

  // Guessing State
  const [jumbledLetters, setJumbledLetters] = useState([]);
  const [guesses, setGuesses] = useState([]);
  const [isShake, setIsShake] = useState(false);

  useEffect(() => {
    // When in production, connect to the exact origin where it is hosted (Render)
    const socketUrl = import.meta.env.PROD
      ? window.location.origin
      : `http://${window.location.hostname}:3001`;

    const newSocket = io(socketUrl);
    setSocket(newSocket);

    newSocket.on('room_created', (id) => {
      setRoomId(id);
      setPhase('lobby');
    });

    newSocket.on('error', (msg) => {
      setErrorObj(msg);
      setTimeout(() => setErrorObj(null), 3000);
    });

    newSocket.on('game_start', ({ roomId, roles }) => {
      setRoomId(roomId);
      const myRole = roles[newSocket.id];
      setRole(myRole);
      if (myRole === 'drawer') {
        startTurnSelection();
      } else {
        setPhase('waiting_for_drawer');
      }
    });

    newSocket.on('word_selected', () => {
      setPhase('drawing_progress');
    });

    newSocket.on('guess_phase', ({ dataUrl, wordObj }) => {
      setDrawingData(dataUrl);
      setCurrentWord(wordObj);
      prepareGuessLayer(wordObj.w);
      setPhase('guess');
    });

    newSocket.on('round_win', ({ score, word, points, roles }) => {
      setScore(score);
      setLastWin({ word, points });
      setPhase('result');

      const myRole = roles[newSocket.id];
      setRole(myRole);
    });

    newSocket.on('player_disconnected', () => {
      alert("השחקן השני התנתק!");
      window.location.reload();
    });

    return () => newSocket.close();
  }, []);

  const createGame = () => {
    socket.emit('create_room');
  };

  const joinMenu = () => setPhase('join');

  const submitJoin = () => {
    if (joinCode.length > 0) socket.emit('join_room', joinCode);
  };

  const startTurnSelection = () => {
    const e = WORDS.easy[Math.floor(Math.random() * WORDS.easy.length)];
    const m = WORDS.medium[Math.floor(Math.random() * WORDS.medium.length)];
    const h = WORDS.hard[Math.floor(Math.random() * WORDS.hard.length)];
    setOptions([
      { ...e, diff: 'easy' },
      { ...m, diff: 'medium' },
      { ...h, diff: 'hard' }
    ]);
    setPhase('select');
  };

  const handleSelectWord = (wordObj) => {
    setCurrentWord(wordObj);
    socket.emit('word_selected', { roomId, wordObj });
    setPhase('draw');
  };

  const handleFinishDrawing = (dataUrl) => {
    socket.emit('finish_drawing', { roomId, dataUrl });
    setPhase('waiting_for_guess');
  };

  const prepareGuessLayer = (wordStr) => {
    const wordLen = wordStr.length;
    const extraCount = 12 - wordLen;
    let letters = wordStr.split('').map((char, index) => ({ id: `word_${index}`, char, used: false }));
    for (let i = 0; i < extraCount; i++) {
      letters.push({ id: `rand_${i}`, char: getRandomLetter(), used: false });
    }
    setJumbledLetters(shuffle(letters));
    setGuesses(Array(wordLen).fill(null));
  };

  const handleKeyClick = (letterObj) => {
    if (letterObj.used) return;
    const emptyIndex = guesses.indexOf(null);
    if (emptyIndex === -1) return;

    const newGuesses = [...guesses];
    newGuesses[emptyIndex] = letterObj;
    setGuesses(newGuesses);

    const newJumbled = jumbledLetters.map(l => l.id === letterObj.id ? { ...l, used: true } : l);
    setJumbledLetters(newJumbled);

    if (!newGuesses.includes(null)) {
      const spelled = newGuesses.map(g => g?.char).join('');
      if (spelled === currentWord.w) {
        socket.emit('guess_correct', { roomId });
      } else {
        setIsShake(true);
        setTimeout(() => setIsShake(false), 500);
      }
    }
  };

  const handleSlotClick = (index) => {
    const guessObj = guesses[index];
    if (!guessObj) return;

    const newGuesses = [...guesses];
    newGuesses[index] = null;
    setGuesses(newGuesses);

    const newJumbled = jumbledLetters.map(l => l.id === guessObj.id ? { ...l, used: false } : l);
    setJumbledLetters(newJumbled);
  };

  const nextTurn = () => {
    if (role === 'drawer') {
      startTurnSelection();
    } else {
      setPhase('waiting_for_drawer');
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <div>צייר משהו</div>
        <div className="coins-display">💰 {score}</div>
      </div>

      {errorObj && <div style={{ background: 'red', color: 'white', padding: '1rem', textAlign: 'center' }}>{errorObj}</div>}

      {phase === 'start' && (
        <div className="screen">
          <h1 className="title">צייר<br />משהו!</h1>
          <button className="btn btn-primary" onClick={createGame}>צור חדר חבר</button>
          <button className="btn btn-success" onClick={joinMenu}>הצטרף לחדר</button>
        </div>
      )}

      {phase === 'lobby' && (
        <div className="screen">
          <h1 className="title">קוד החדר:</h1>
          <h1 style={{ fontSize: '4rem', letterSpacing: '8px', color: 'var(--primary)', marginBottom: '2rem' }}>{roomId}</h1>
          <h2>מחכה לשחקן השני שיצטרף...</h2>
        </div>
      )}

      {phase === 'join' && (
        <div className="screen">
          <h1 className="title">הכנס קוד:</h1>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            style={{ fontSize: '2rem', padding: '1rem', textAlign: 'center', marginBottom: '1rem', borderRadius: '8px', border: '2px solid var(--primary)' }}
          />
          <button className="btn btn-success" onClick={submitJoin}>הצטרף</button>
          <button className="btn" style={{ marginTop: '1rem' }} onClick={() => setPhase('start')}>חזור</button>
        </div>
      )}

      {phase === 'waiting_for_drawer' && (
        <div className="screen">
          <h2 style={{ textAlign: 'center', opacity: 0.8 }}>השחקן השני בוחר מילה לציור...</h2>
          <div style={{ marginTop: '2rem' }} className="loader">⏳</div>
        </div>
      )}

      {phase === 'drawing_progress' && (
        <div className="screen">
          <h2 style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>השחקן השני מצייר עכשיו!</h2>
          <h3 style={{ textAlign: 'center', marginTop: '1rem' }}>הכן את עצמך לנחש...</h3>
          <div style={{ marginTop: '2rem' }} className="loader">🎨</div>
        </div>
      )}

      {phase === 'select' && (
        <div className="screen">
          <h2 style={{ marginBottom: '2rem' }}>בחר מילה לציור:</h2>
          {options.map((opt, i) => (
            <div key={i} className={`word-card ${opt.diff}`} onClick={() => handleSelectWord(opt)}>
              <div className="word-text">{opt.w}</div>
              <div className="points-text">💰 {opt.c} מטבעות</div>
            </div>
          ))}
        </div>
      )}

      {phase === 'draw' && (
        <DrawingBoard word={currentWord.w} onFinish={handleFinishDrawing} />
      )}

      {phase === 'waiting_for_guess' && (
        <div className="screen">
          <h1 className="title">סיימת לצייר!</h1>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>מחכה שהשחקן השני ינחש את המילה...</h2>
        </div>
      )}

      {phase === 'guess' && (
        <div className="screen">
          <div className="canvas-container" style={{ boxShadow: 'none' }}>
            <img src={drawingData} alt="Drawing" className="drawing-image" />
          </div>

          <div className={`guess-display ${isShake ? 'shake' : ''}`}>
            {guesses.map((g, i) => {
              const isCorrect = g && g.char === currentWord.w[i];
              return (
                <div
                  key={i}
                  className={`letter-slot ${g ? 'filled' : ''} ${isCorrect ? 'correct' : ''}`}
                  onClick={() => handleSlotClick(i)}
                >
                  {g ? g.char : ''}
                </div>
              );
            })}
          </div>

          <div className="keyboard">
            {jumbledLetters.map(l => (
              <button
                key={l.id}
                className={`key ${l.used ? 'hidden' : ''}`}
                onClick={() => handleKeyClick(l)}
              >
                {l.char}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div className="screen">
          <div className="result-card">
            <h1 className="title" style={{ fontSize: '2.5rem' }}>כל הכבוד!</h1>
            <h2 style={{ marginBottom: '1rem' }}>המילה הייתה:<br /><span style={{ fontSize: '3rem', color: 'var(--primary)' }}>{lastWin.word}</span></h2>
            <div className="coins-display" style={{ justifyContent: 'center', fontSize: '1.5rem', marginBottom: '2rem' }}>
              +💰 {lastWin.points} מטבעות
            </div>
            <button className="btn btn-success" onClick={nextTurn}>
              {role === 'drawer' ? 'תורי לצייר!' : 'מחכה שהחקן השני יבחר מילה...'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DrawingBoard({ word, onFinish }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.width;

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    if (e.cancelable) e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = color;
    if (color === '#FFFFFF') {
      ctx.lineWidth = 20;
    } else {
      ctx.lineWidth = 6;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="screen" style={{ padding: '1rem', justifyContent: 'flex-start' }}>
      <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>
        צייר: <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{word}</span>
      </h3>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          className="drawing-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={finishDrawing}
          onMouseLeave={finishDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={finishDrawing}
          onTouchCancel={finishDrawing}
        />
      </div>

      <div className="tools">
        {COLORS.map(c => (
          <button
            key={c}
            className={`color-btn ${color === c ? 'active' : ''}`}
            style={{ backgroundColor: c, border: c === '#FFFFFF' ? '3px solid #ccc' : '' }}
            onClick={() => setColor(c)}
          >
            {c === '#FFFFFF' ? '🧽' : ''}
          </button>
        ))}
        <button className="action-btn" onClick={handleClear} title="Clear">🗑️</button>
      </div>

      <button className="btn btn-success" style={{ marginTop: 'auto' }} onClick={() => onFinish(canvasRef.current.toDataURL())}>
        סיימתי לצייר
      </button>
    </div>
  );
}
