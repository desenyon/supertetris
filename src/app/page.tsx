"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// SuperTetris — Next.js-ready React component
// Features: 7-bag RNG, SRS kicks, hold, variable preview count, ghost piece (toggle),
// soft/hard drop, DAS/ARR, lock delay, scoring (combo + back-to-back), pause/reset.
// + Settings panel to tweak mechanics live. Tailwind styling. Vercel-ready.

// === Types ===
 type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0 empty, 1-7 tetromino ids
 type Board = Cell[][]; // [row][col]
 type Point = { x: number; y: number };
 type Rotation = 0 | 1 | 2 | 3; // 0: spawn, 1: R, 2: 180, 3: L
 type PieceId = 1 | 2 | 3 | 4 | 5 | 6 | 7; // I, J, L, O, S, T, Z mapped any order below

// === Board ===
const COLS = 10;
const ROWS = 22; // includes 2 hidden rows at top
const VISIBLE_ROWS = 20;

// Level -> frames per row at 60fps
const GRAVITY_LEVEL_FRAMES = [
  48, 43, 38, 33, 28, 23, 18, 13, 8, 6,
  5, 5, 4, 4, 3, 3, 2, 2, 1, 1
];

// === Pieces ===
// Order: I, J, L, O, S, T, Z => 1..7
const SHAPES: Record<PieceId, Point[][]> = {
  1: [ // I
    [ {x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:2,y:0} ],
    [ {x:1,y:-1}, {x:1,y:0}, {x:1,y:1}, {x:1,y:2} ],
    [ {x:-1,y:1}, {x:0,y:1}, {x:1,y:1}, {x:2,y:1} ],
    [ {x:0,y:-1}, {x:0,y:0}, {x:0,y:1}, {x:0,y:2} ],
  ],
  2: [ // J
    [ {x:-1,y:0}, {x:-1,y:1}, {x:0,y:1}, {x:1,y:1} ],
    [ {x:0,y:-1}, {x:0,y:0}, {x:0,y:1}, {x:-1,y:1} ],
    [ {x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:1,y:1} ],
    [ {x:0,y:-1}, {x:1,y:-1}, {x:0,y:0}, {x:0,y:1} ],
  ],
  3: [ // L
    [ {x:1,y:0}, {x:-1,y:1}, {x:0,y:1}, {x:1,y:1} ],
    [ {x:0,y:-1}, {x:0,y:0}, {x:0,y:1}, {x:1,y:1} ],
    [ {x:-1,y:0}, {x:-1,y:1}, {x:0,y:0}, {x:1,y:0} ],
    [ {x:-1,y:-1}, {x:0,y:-1}, {x:0,y:0}, {x:0,y:1} ],
  ],
  4: [ // O
    [ {x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:1,y:1} ],
    [ {x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:1,y:1} ],
    [ {x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:1,y:1} ],
    [ {x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:1,y:1} ],
  ],
  5: [ // S
    [ {x:0,y:0}, {x:1,y:0}, {x:-1,y:1}, {x:0,y:1} ],
    [ {x:0,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:1,y:1} ],
    [ {x:0,y:0}, {x:1,y:0}, {x:-1,y:1}, {x:0,y:1} ],
    [ {x:0,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:1,y:1} ],
  ],
  6: [ // T
    [ {x:0,y:0}, {x:-1,y:1}, {x:0,y:1}, {x:1,y:1} ],
    [ {x:0,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1} ],
    [ {x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1} ],
    [ {x:0,y:-1}, {x:-1,y:0}, {x:0,y:0}, {x:0,y:1} ],
  ],
  7: [ // Z
    [ {x:-1,y:0}, {x:0,y:0}, {x:0,y:1}, {x:1,y:1} ],
    [ {x:1,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1} ],
    [ {x:-1,y:0}, {x:0,y:0}, {x:0,y:1}, {x:1,y:1} ],
    [ {x:1,y:-1}, {x:0,y:0}, {x:1,y:0}, {x:0,y:1} ],
  ],
};

// SRS kick tables (JLSTZ), I, O (O has trivial kicks)
const KICKS_JLSTZ: Record<string, Point[]> = {
  "0>1": [ {x:0,y:0},{x:-1,y:0},{x:-1,y:-1},{x:0,y:2},{x:-1,y:2} ],
  "1>0": [ {x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:-2},{x:1,y:-2} ],
  "1>2": [ {x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:-2},{x:1,y:-2} ],
  "2>1": [ {x:0,y:0},{x:-1,y:0},{x:-1,y:-1},{x:0,y:2},{x:-1,y:2} ],
  "2>3": [ {x:0,y:0},{x:1,y:0},{x:1,y:-1},{x:0,y:2},{x:1,y:2} ],
  "3>2": [ {x:0,y:0},{x:-1,y:0},{x:-1,y:1},{x:0,y:-2},{x:-1,y:-2} ],
  "3>0": [ {x:0,y:0},{x:-1,y:0},{x:-1,y:1},{x:0,y:-2},{x:-1,y:-2} ],
  "0>3": [ {x:0,y:0},{x:1,y:0},{x:1,y:-1},{x:0,y:2},{x:1,y:2} ],
};
const KICKS_I: Record<string, Point[]> = {
  "0>1": [ {x:0,y:0},{x:-2,y:0},{x:1,y:0},{x:-2,y:-1},{x:1,y:2} ],
  "1>0": [ {x:0,y:0},{x:2,y:0},{x:-1,y:0},{x:2,y:1},{x:-1,y:-2} ],
  "1>2": [ {x:0,y:0},{x:-1,y:0},{x:2,y:0},{x:-1,y:2},{x:2,y:-1} ],
  "2>1": [ {x:0,y:0},{x:1,y:0},{x:-2,y:0},{x:1,y:-2},{x:-2,y:1} ],
  "2>3": [ {x:0,y:0},{x:2,y:0},{x:-1,y:0},{x:2,y:1},{x:-1,y:-2} ],
  "3>2": [ {x:0,y:0},{x:-2,y:0},{x:1,y:0},{x:-2,y:-1},{x:1,y:2} ],
  "3>0": [ {x:0,y:0},{x:1,y:0},{x:-2,y:0},{x:1,y:-2},{x:-2,y:1} ],
  "0>3": [ {x:0,y:0},{x:-1,y:0},{x:2,y:0},{x:-1,y:2},{x:2,y:-1} ],
};

const COLORS: Record<Cell, string> = {
  0: "#0b0f17",
  1: "#29b6f6", // I
  2: "#3f51b5", // J
  3: "#ff9800", // L
  4: "#fdd835", // O
  5: "#4caf50", // S
  6: "#9c27b0", // T
  7: "#f44336", // Z
};

// === Utilities ===
const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const bag7 = (() => {
  let bag: PieceId[] = [];
  const refill = () => { bag = [1,2,3,4,5,6,7].sort(() => Math.random() - 0.5) as PieceId[]; };
  return () => { if (bag.length === 0) refill(); return bag.shift()!; };
})();

// === Settings ===
function useSettings() {
  const [das, setDas] = useState(130);
  const [arr, setArr] = useState(20); // 0 = instant
  const [lockDelay, setLockDelay] = useState(500);
  const [previewCount, setPreviewCount] = useState(5);
  const [ghost, setGhost] = useState(true);
  const [startLevel, setStartLevel] = useState(1);
  return { das, setDas, arr, setArr, lockDelay, setLockDelay, previewCount, setPreviewCount, ghost, setGhost, startLevel, setStartLevel } as const;
}

// === Game State ===
function useTetris(settings: ReturnType<typeof useSettings>) {
  const { das, arr, lockDelay, previewCount, startLevel } = settings;
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [activeId, setActiveId] = useState<PieceId | 0>(0);
  const [rot, setRot] = useState<Rotation>(0);
  const [pos, setPos] = useState<Point>({ x: 4, y: 0 });
  const [queue, setQueue] = useState<PieceId[]>([]);
  const [hold, setHold] = useState<PieceId | 0>(0);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(startLevel);
  const [combo, setCombo] = useState(-1);
  const [b2b, setB2b] = useState(false);
  const [pause, setPause] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const lockTimer = useRef<number | null>(null);
  const arrTimer = useRef<number | null>(null);
  const dasTimer = useRef<number | null>(null);
  const shiftDir = useRef<0 | -1 | 1>(0);
  const lastFall = useRef<number>(performance.now());
  const gravFrame = useRef(0);

  const canPlace = useCallback((b: Board, id: PieceId, p: Point, r: Rotation) => {
    const cells = SHAPES[id][r];
    return cells.every(c => {
      const x = p.x + c.x;
      const y = p.y + c.y;
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y < 0) return true; // above the top is fine
      return b[y][x] === 0;
    });
  }, []);

  const merge = useCallback((b: Board, id: PieceId, p: Point, r: Rotation) => {
    const nb = clone(b);
    for (const c of SHAPES[id][r]) {
      const x = p.x + c.x;
      const y = p.y + c.y;
      if (y >= 0) nb[y][x] = id as Cell;
    }
    return nb;
  }, []);

  const spawn = useCallback((forced?: PieceId) => {
    const id: PieceId = forced ?? (queue.length ? queue[0] : bag7());
    const nextQueue = forced ? queue : (queue.length ? queue.slice(1) : []);
    while (nextQueue.length < previewCount) nextQueue.push(bag7());

    const spawnX = 4; const spawnY = 0;
    setActiveId(id); setRot(0); setPos({ x: spawnX, y: spawnY }); setQueue(nextQueue); setCanHold(true);

    const collides = !canPlace(board, id, { x: spawnX, y: spawnY }, 0);
    if (collides) setGameOver(true);
  }, [board, canPlace, previewCount, queue]);

  const reset = useCallback(() => {
    setBoard(emptyBoard()); setActiveId(0); setRot(0); setPos({ x: 4, y: 0 }); setQueue([]);
    setHold(0); setCanHold(true); setScore(0); setLines(0); setLevel(startLevel);
    setCombo(-1); setB2b(false); setPause(false); setGameOver(false);
    gravFrame.current = 0; lastFall.current = performance.now();
  }, [startLevel]);

  useEffect(() => { // initialize queue + first spawn
    if (activeId !== 0) return;
    const q: PieceId[] = [];
    while (q.length < previewCount) q.push(bag7());
    setQueue(q); setTimeout(() => spawn(), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewCount]);

  const hardDropTarget = useMemo(() => {
    if (!activeId) return pos;
    let py = pos.y;
    while (canPlace(board, activeId as PieceId, { x: pos.x, y: py + 1 }, rot)) py++;
    return { x: pos.x, y: py };
  }, [board, pos, rot, activeId, canPlace]);

  const clearLines = useCallback((b: Board) => {
    const remain = b.filter((row) => row.some(c => c === 0));
    const cleared = ROWS - remain.length;
    while (remain.length < ROWS) remain.unshift(Array(COLS).fill(0) as Cell[]);
    return { board: remain, cleared };
  }, []);

  const addScore = useCallback((cleared: number, tspin: boolean) => {
    let gained = 0; let b2bNow = b2b;
    if (tspin) { if (cleared === 1) gained = 800; else if (cleared === 2) gained = 1200; else if (cleared === 3) gained = 1600; }
    else { if (cleared === 1) gained = 100; else if (cleared === 2) gained = 300; else if (cleared === 3) gained = 500; else if (cleared === 4) gained = 800; }
    if ((tspin && cleared > 0) || cleared === 4) { if (b2b) gained = Math.floor(gained * 1.5); b2bNow = true; }
    else if (cleared > 0) { b2bNow = false; }

    let comboNow = combo;
    if (cleared > 0) { comboNow = combo + 1; if (comboNow > 0) gained += 50 * comboNow; }
    else { comboNow = -1; }

    setCombo(comboNow); setB2b(b2bNow); setScore(s => s + gained * Math.max(1, level));
    if (cleared > 0) setLines(l => { const newLines = l + cleared; const newLevel = Math.max(startLevel, 1 + Math.floor(newLines / 10)); setLevel(newLevel); return newLines; });
  }, [b2b, combo, level, startLevel]);

  const tryLock = useCallback(() => {
    if (!activeId) return;
    const merged = merge(board, activeId, pos, rot);
    const { board: clearedBoard, cleared } = clearLines(merged);
    const tspin = activeId === 6 && isTSpin(board, pos, rot);
    addScore(cleared, tspin);
    setBoard(clearedBoard); spawn();
  }, [activeId, addScore, board, clearLines, merge, pos, rot, spawn]);

  // Gravity & lock delay loop
  useEffect(() => {
    if (pause || gameOver) return;
    let raf = 0;
    const tick = (time: number) => {
      const fps = 60; const framesPerRow = GRAVITY_LEVEL_FRAMES[Math.min(level - 1, GRAVITY_LEVEL_FRAMES.length - 1)];
      if (time - lastFall.current >= (1000 / fps)) {
        lastFall.current = time; gravFrame.current++;
        if (gravFrame.current >= framesPerRow) {
          gravFrame.current = 0;
          if (activeId && canPlace(board, activeId, { x: pos.x, y: pos.y + 1 }, rot)) {
            setPos(p => ({ ...p, y: p.y + 1 })); if (lockTimer.current !== null) { window.clearTimeout(lockTimer.current); lockTimer.current = null; }
          } else if (activeId) {
            if (lockTimer.current === null) {
              lockTimer.current = window.setTimeout(() => { tryLock(); lockTimer.current = null; }, lockDelay);
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeId, board, canPlace, gameOver, level, pause, pos.x, pos.y, rot, tryLock, lockDelay]);

  // Input handling with DAS/ARR
  useEffect(() => {
    if (pause || gameOver) return;

    const move = (dir: -1 | 1) => {
      if (!activeId) return;
      if (canPlace(board, activeId, { x: pos.x + dir, y: pos.y }, rot)) setPos(p => ({ ...p, x: p.x + dir }));
    };

    const startAutoShift = (dir: -1 | 1) => {
      shiftDir.current = dir;
      if (dasTimer.current) window.clearTimeout(dasTimer.current);
      if (arrTimer.current) window.clearInterval(arrTimer.current);

      move(dir); // initial

      dasTimer.current = window.setTimeout(() => {
        if (arr === 0) {
          const step = () => {
            if (!activeId) return false;
            if (canPlace(board, activeId, { x: pos.x + dir, y: pos.y }, rot)) { setPos(p => ({ ...p, x: p.x + dir })); return true; }
            return false;
          };
          while (step()) {}
        } else {
          arrTimer.current = window.setInterval(() => move(dir), arr);
        }
      }, das);
    };

    const stopAutoShift = (dir: -1 | 1) => {
      if (shiftDir.current === dir) {
        shiftDir.current = 0;
        if (dasTimer.current) window.clearTimeout(dasTimer.current);
        if (arrTimer.current) window.clearInterval(arrTimer.current);
        dasTimer.current = null; arrTimer.current = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) e.preventDefault();
      switch (e.key) {
        case "ArrowLeft": startAutoShift(-1); e.preventDefault(); break;
        case "ArrowRight": startAutoShift(1); e.preventDefault(); break;
        case "ArrowDown":
          if (activeId && canPlace(board, activeId, { x: pos.x, y: pos.y + 1 }, rot)) { setPos(p => ({ ...p, y: p.y + 1 })); setScore(s => s + 1); }
          e.preventDefault(); break;
        case " ": case "x": case "X": {
          if (!activeId) break; setPos(hardDropTarget);
          const merged = merge(board, activeId, hardDropTarget, rot);
          const { board: clearedBoard, cleared } = clearLines(merged);
          const tspin = activeId === 6 && isTSpin(board, hardDropTarget, rot);
          const yDist = hardDropTarget.y - pos.y; setScore(s => s + 2 * yDist * Math.max(1, level));
          addScore(cleared, tspin); setBoard(clearedBoard); spawn(); e.preventDefault(); break; }
        case "ArrowUp": case "z": case "Z": rotate(+1); e.preventDefault(); break;
        case "a": case "A": case "Control": rotate(-1); e.preventDefault(); break;
        case "c": case "C": doHold(); e.preventDefault(); break;
        case "p": case "P": setPause(p => !p); break;
        case "r": case "R": reset(); break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.key) { case "ArrowLeft": stopAutoShift(-1); break; case "ArrowRight": stopAutoShift(1); break; }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (dasTimer.current) window.clearTimeout(dasTimer.current);
      if (arrTimer.current) window.clearInterval(arrTimer.current);
    };
  }, [activeId, addScore, arr, board, canPlace, clearLines, hardDropTarget, level, merge, pause, gameOver, pos.x, pos.y, reset, rot, spawn, settings]);

  const rotate = useCallback((dir: -1 | 1) => {
    if (!activeId) return;
    const from: Rotation = rot; const to: Rotation = (((rot + (dir === 1 ? 1 : 3)) % 4) as Rotation);
    const key = `${from}>${to}`; const kicks = activeId === 1 ? KICKS_I[key] : (activeId === 4 ? [{x:0,y:0}] : KICKS_JLSTZ[key]);
    for (const k of kicks) { const np = { x: pos.x + k.x, y: pos.y + k.y }; if (canPlace(board, activeId, np, to)) { setRot(to); setPos(np); if (lockTimer.current !== null) { window.clearTimeout(lockTimer.current); lockTimer.current = null; } return; } }
  }, [activeId, board, canPlace, pos.x, pos.y, rot]);

  const doHold = useCallback(() => {
    if (!activeId || !canHold) return;
    if (hold === 0) { setHold(activeId); spawn(); }
    else { setHold(activeId); spawn(hold as PieceId); }
    setCanHold(false);
  }, [activeId, canHold, hold, spawn]);

  return { board, activeId, pos, rot, queue, hold, canHold, score, lines, level, combo, b2b, pause, gameOver, hardDropTarget, reset, setPause } as const;
}

// T-Spin detection (heuristic)
function isTSpin(board: Board, pos: Point, rot: Rotation) {
  const corners = [ { x: pos.x - 1, y: pos.y }, { x: pos.x + 1, y: pos.y }, { x: pos.x, y: pos.y + 1 }, { x: pos.x, y: pos.y - 1 } ];
  const solid = corners.reduce((acc, c) => acc + (!inBounds(c.x, c.y) || board[c.y]?.[c.x] ? 1 : 0), 0);
  return solid >= 3; // treat as full T-spin
}
function inBounds(x: number, y: number) { return x >= 0 && x < COLS && y < ROWS; }

// === Rendering ===
function useCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  useEffect(() => { if (!ref.current) return; ctx.current = ref.current.getContext("2d"); }, []);
  return { ref, ctx } as const;
}

function drawBoard(ctx: CanvasRenderingContext2D, board: Board) {
  const w = ctx.canvas.width; const h = ctx.canvas.height;
  ctx.fillStyle = "#0b0f17"; ctx.fillRect(0, 0, w, h);
  const cw = Math.floor(w / COLS); const ch = Math.floor(h / VISIBLE_ROWS);
  for (let y = 2; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = board[y][x];
      if (c) drawCell(ctx, x, y - 2, cw, ch, COLORS[c]);
      else { ctx.strokeStyle = "#131a26"; ctx.lineWidth = 1; ctx.strokeRect(x * cw, (y - 2) * ch, cw, ch); }
    }
  }
}

function drawActiveAndGhost(ctx: CanvasRenderingContext2D, id: PieceId | 0, pos: Point, rot: Rotation, board: Board, showGhost: boolean) {
  if (!id) return;
  const w = ctx.canvas.width; const h = ctx.canvas.height; const cw = Math.floor(w / COLS); const ch = Math.floor(h / VISIBLE_ROWS);
  if (showGhost) {
    let gy = pos.y; while (canPlaceStatic(board, id, { x: pos.x, y: gy + 1 }, rot)) gy++;
    SHAPES[id][rot].forEach(c => { const x = pos.x + c.x; const y = gy + c.y - 2; if (y >= 0) drawCell(ctx, x, y, cw, ch, COLORS[id], true); });
  }
  SHAPES[id][rot].forEach(c => { const x = pos.x + c.x; const y = pos.y + c.y - 2; if (y >= 0) drawCell(ctx, x, y, cw, ch, COLORS[id]); });
}

function canPlaceStatic(b: Board, id: PieceId, p: Point, r: Rotation) {
  const cells = SHAPES[id][r];
  return cells.every(c => {
    const x = p.x + c.x; const y = p.y + c.y;
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y < 0) return true; return b[y][x] === 0;
  });
}

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, cw: number, ch: number, color: string, ghost = false) {
  const px = x * cw; const py = y * ch;
  ctx.fillStyle = ghost ? `${color}55` : color; ctx.fillRect(px, py, cw, ch);
  ctx.strokeStyle = "#00000055"; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, cw - 2, ch - 2);
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-3 bg-[#0d1422] shadow-md border border-[#17223b]">
      <div className="text-sm tracking-wide text-white/70 mb-2">{title}</div>
      {children}
    </div>
  );
}

export default function SuperTetris() {
  const settings = useSettings();
  const { das, arr, lockDelay, previewCount, ghost, startLevel, setDas, setArr, setLockDelay, setPreviewCount, setGhost, setStartLevel } = settings;
  const { board, activeId, pos, rot, queue, hold, canHold, score, lines, level, combo, b2b, pause, gameOver, reset } = useTetris(settings);
  const { ref, ctx } = useCanvas();

  // Resize canvas responsively and re-draw
  useEffect(() => {
    const canvas = ref.current!;
    const resize = () => {
      const w = Math.min(520, Math.max(280, Math.floor(window.innerWidth * 0.36)));
      canvas.width = w; canvas.height = Math.floor(w * (20 / 10));
      if (!ctx.current) return;
      drawBoard(ctx.current, board);
      drawActiveAndGhost(ctx.current, activeId as any, pos, rot, board, ghost);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [board, activeId, pos, rot, ghost]);

  useEffect(() => { if (!ctx.current) return; drawBoard(ctx.current, board); drawActiveAndGhost(ctx.current, activeId as any, pos, rot, board, ghost); }, [board, activeId, pos, rot, ctx, ghost]);

  const renderMini = (id: PieceId | 0, cell = 16) => {
    if (!id) return <div className="h-16"/>;
    const cells = SHAPES[id][0];
    const minX = Math.min(...cells.map(c => c.x)); const minY = Math.min(...cells.map(c => c.y));
    const normalized = cells.map(c => ({ x: c.x - minX, y: c.y - minY }));
    const w = Math.max(...normalized.map(c => c.x)) + 1; const h = Math.max(...normalized.map(c => c.y)) + 1;
    return (
      <div className="relative inline-block" style={{ width: w*cell, height: h*cell }}>
        {normalized.map((c,i) => (
          <div key={i} style={{ position:'absolute', left: c.x*cell, top: c.y*cell, width: cell, height: cell, background: COLORS[id] }} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#0b0f17] text-white">
      <div className="mx-auto max-w-6xl px-4 md:px-8 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">SuperTetris</h1>
          <div className="text-sm text-white/60">Controls: ←/→ move • ↓ soft • Space/X hard • ↑/Z CW • Ctrl/A CCW • C hold • P pause • R reset</div>
        </div>

        <div className="flex gap-4 lg:gap-6 items-start">
          {/* LEFT: Hold & Stats */}
          <div className="shrink-0 w-60 md:w-64 space-y-4">
            <SidePanel title="Hold">
              <div className="text-xs text-white/60 mb-2">{canHold ? "(Available)" : "(Used)"}</div>
              <div className="h-20 flex items-center">{renderMini(hold)}</div>
              <div className="text-xs text-white/60 mt-2">Press C to Hold</div>
            </SidePanel>

            <SidePanel title="Stats">
              <div className="grid grid-cols-2 gap-y-1 text-white/90">
                <div>Score</div><div className="text-right font-mono">{score}</div>
                <div>Lines</div><div className="text-right font-mono">{lines}</div>
                <div>Level</div><div className="text-right font-mono">{level}</div>
                <div>Combo</div><div className="text-right font-mono">{combo >= 0 ? combo : '-'}</div>
                <div>B2B</div><div className="text-right font-mono">{b2b ? 'Yes' : 'No'}</div>
              </div>
            </SidePanel>
          </div>

          {/* CENTER: Game */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              <canvas ref={ref} className="rounded-2xl border border-[#17223b] shadow-xl" />
              {(pause || gameOver) && (
                <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-semibold mb-2">{gameOver ? 'Game Over' : 'Paused'}</div>
                    <div className="text-white/70">Press {gameOver ? 'R to Restart' : 'P to Resume'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Next + Settings (fixed width so it won't hug the edge) */}
          <div className="shrink-0 w-60 md:w-64 space-y-4">
            <SidePanel title="Next">
              <div className="flex flex-col gap-3">
                {queue.slice(0, previewCount).map((id, i) => (
                  <div key={i} className="h-16 flex items-center">{renderMini(id)}</div>
                ))}
              </div>
            </SidePanel>

            <SidePanel title="Settings">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-white/80">DAS</label>
                  <input type="number" className="w-24 bg-[#0b0f17] border border-white/10 rounded px-2 py-1" value={das} min={0} max={400} step={10} onChange={e=>settings.setDas(parseInt(e.target.value||"0"))} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-white/80">ARR</label>
                  <input type="number" className="w-24 bg-[#0b0f17] border border-white/10 rounded px-2 py-1" value={arr} min={0} max={200} step={5} onChange={e=>settings.setArr(parseInt(e.target.value||"0"))} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-white/80">Lock Delay</label>
                  <input type="number" className="w-24 bg-[#0b0f17] border border-white/10 rounded px-2 py-1" value={lockDelay} min={0} max={2000} step={50} onChange={e=>settings.setLockDelay(parseInt(e.target.value||"0"))} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-white/80">Preview</label>
                  <input type="number" className="w-24 bg-[#0b0f17] border border-white/10 rounded px-2 py-1" value={previewCount} min={1} max={7} onChange={e=>settings.setPreviewCount(Math.max(1, Math.min(7, parseInt(e.target.value||"1"))))} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-white/80">Start Level</label>
                  <input type="number" className="w-24 bg-[#0b0f17] border border-white/10 rounded px-2 py-1" value={startLevel} min={1} max={20} onChange={e=>setStartLevel(Math.max(1, Math.min(20, parseInt(e.target.value||"1"))))} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-white/80">Ghost</label>
                  <input type="checkbox" className="h-4 w-4" checked={ghost} onChange={e=>setGhost(e.target.checked)} />
                </div>
                <div className="pt-2 flex gap-2">
                  <button className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15" onClick={reset}>Reset Game</button>
                </div>
              </div>
            </SidePanel>
          </div>
        </div>
      </div>
    </div>
  );
}
