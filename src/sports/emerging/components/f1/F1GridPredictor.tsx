/**
 * F1 multi-stage grid predictor.
 * Updated with Sticky Mobile Target Context and Grid-to-Grid Dragging.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lock, RotateCcw, Timer, WifiOff, CloudOff } from 'lucide-react';
import type { F1Driver } from '../../types';
import F1DriverCard from './F1DriverCard';
import F1HelmetIcon from './F1HelmetIcon';
import ConfirmPicksButton from '../../../../components/ConfirmPicksButton';

export type F1GridPredictorProps = {
  drivers: F1Driver[];
  onConfirm?: (payload: {
    quali: string[];
    race: string[];
    fastestLap: string | null;
  }) => void;
  className?: string;
};

type Phase = 'quali' | 'race' | 'complete';
type Slot = string | null;

const QUALI_SLOTS = 10;
const RACE_SLOTS = 6;
const SLOT_MIN_H = 'min-h-[4.75rem] sm:min-h-[5.75rem]';
const HALF_SLOT_SPACER = 'h-[2.375rem] sm:h-[2.875rem] shrink-0';
const PAIR_GAP = 'gap-y-3 sm:gap-y-5';

/** Lower weight = higher Constructors' Championship standing (pool grouping order). */
const TEAM_SORT_WEIGHT: Record<string, number> = {
  red_bull: 1,
  mclaren: 2,
  ferrari: 3,
  mercedes: 4,
  aston_martin: 5,
  racing_bulls: 6,
  haas: 7,
  alpine: 8,
  williams: 9,
  audi: 10,
  cadillac: 11,
};

function SortableDriverRow({
  driver,
  onTap,
  selected,
  dimmed,
}: {
  driver: F1Driver;
  onTap: () => void;
  selected: boolean;
  dimmed?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: driver.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <F1DriverCard
      driver={driver}
      selected={selected}
      dimmed={dimmed}
      onClick={onTap}
      setNodeRef={setNodeRef}
      style={style}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

function PlacedDriverTile({ driver }: { driver: F1Driver }) {
  return (
    <div className="flex flex-col items-center text-center gap-0.5 min-w-0 w-full py-0.5 pointer-events-none">
      <F1HelmetIcon
        constructorId={driver.constructorId}
        colorHex={driver.teamColorHex}
        title={driver.constructorName ?? undefined}
        className="h-9 w-9 sm:h-11 sm:w-11 shrink-0"
      />
      <div className="min-w-0 w-full px-0.5">
        <div className="text-[10px] sm:text-[11px] font-semibold text-slate-100 truncate leading-none">
          {driver.name}
        </div>
        <div className="text-[8px] sm:text-[9px] font-mono text-slate-500 leading-tight mt-0.5 whitespace-normal break-words">
          {driver.constructorName ?? '-'}
        </div>
        <div className="text-[9px] sm:text-[10px] font-mono text-slate-400 tabular-nums leading-none">
          #{driver.permanentNumber ?? '-'}
        </div>
      </div>
    </div>
  );
}

// NEW: Makes placed drivers draggable to other grid slots
function DraggablePlacedDriver({ driver, locked }: { driver: F1Driver; locked?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: driver.id,
    disabled: locked,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`w-full touch-none ${isDragging ? 'opacity-50' : 'opacity-100'}`}
    >
      <PlacedDriverTile driver={driver} />
    </div>
  );
}

function GridSlot({
  dropId,
  index,
  driver,
  active,
  isNextTarget,
  locked,
  onTap,
}: {
  dropId: string;
  index: number;
  driver: F1Driver | null;
  active: boolean;
  isNextTarget?: boolean;
  locked?: boolean;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    disabled: locked,
  });
  const pos = index + 1;

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={locked}
      onClick={locked ? undefined : onTap}
      className={`relative flex flex-col items-stretch rounded-xl border px-1.5 py-1.5 sm:px-2 sm:py-2 text-left transition-all ${SLOT_MIN_H} w-full ${
        locked
          ? 'border-emerald-500/30 bg-slate-900/90 cursor-default'
          : isOver || active
            ? 'border-violet-400 bg-violet-500/20 ring-1 ring-violet-400/40'
            : isNextTarget
              ? 'border-violet-500/80 bg-violet-950/50 ring-1 ring-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.15)] animate-pulse'
              : driver
                ? 'border-slate-600 bg-slate-900'
                : 'border-dashed border-slate-700 bg-slate-950/60 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center justify-between w-full mb-0.5">
        <span className="font-mono text-[9px] sm:text-[10px] text-slate-500 flex items-center gap-1">
          P{pos}
          {locked && <Lock className="h-2.5 w-2.5 text-emerald-400/80" />}
        </span>
      </div>

      {driver ? (
        <DraggablePlacedDriver driver={driver} locked={locked} />
      ) : (
        <span className="flex-1 flex items-center justify-center text-[10px] sm:text-[11px] text-slate-600">
          Empty
        </span>
      )}
    </button>
  );
}

function FastestLapZone({
  driver,
  active,
  locked,
  onTap,
}: {
  driver: F1Driver | null;
  active: boolean;
  locked?: boolean;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'slot:fastest_lap',
    disabled: locked,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={locked}
      onClick={locked ? undefined : onTap}
      className={`mt-3 w-full rounded-2xl border-2 px-2.5 py-2 sm:px-3 sm:py-3 transition-all ${
        locked
          ? 'border-amber-500/40 bg-amber-500/10 cursor-default'
          : isOver || active
            ? 'border-amber-300 bg-amber-500/20 shadow-[0_0_28px_rgba(251,191,36,0.45)]'
            : driver
              ? 'border-amber-400/70 bg-amber-500/10 shadow-[0_0_20px_rgba(251,191,36,0.28)]'
              : 'border-amber-500/40 bg-slate-950/80 shadow-[0_0_18px_rgba(251,191,36,0.15)] hover:border-amber-400/60'
      }`}
    >
      <div className="flex items-center justify-center gap-1.5 text-amber-300 mb-1">
        <Timer className={`h-3.5 w-3.5 ${locked ? '' : 'animate-pulse'}`} />
        <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider">
          Fastest Lap
        </span>
        {locked && <Lock className="h-3 w-3 text-amber-300/80" />}
      </div>
      {driver ? (
        <DraggablePlacedDriver driver={driver} locked={locked} />
      ) : (
        <p className="text-[10px] text-amber-200/60 text-center font-mono">
          Drop any driver for fastest lap bonus
        </p>
      )}
    </button>
  );
}

function CheckeredStartLine() {
  return (
    <div
      role="presentation"
      aria-hidden
      className="mb-2 sm:mb-3 h-2.5 sm:h-3 w-full rounded-sm overflow-hidden border border-slate-600/80 shadow-inner"
      style={{
        backgroundImage:
          'repeating-conic-gradient(#0f172a 0% 25%, #f8fafc 0% 50%)',
        backgroundSize: '10px 10px',
      }}
    />
  );
}

function StaggeredGrid({
  slots,
  idPrefix,
  byId,
  tapDriverId,
  nextEmptyIndex,
  locked,
  onSlotTap,
}: {
  slots: Slot[];
  idPrefix: 'quali' | 'race';
  byId: Map<string, F1Driver>;
  tapDriverId: string | null;
  nextEmptyIndex: number;
  locked?: boolean;
  onSlotTap: (index: number) => void;
}) {
  const pairs: [number, number | null][] = [];
  for (let i = 0; i < slots.length; i += 2) {
    pairs.push([i, i + 1 < slots.length ? i + 1 : null]);
  }

  return (
    <div className="w-full">
      <CheckeredStartLine />
      <div className={`flex flex-col ${PAIR_GAP}`}>
        {pairs.map(([oddIdx, evenIdx]) => (
          <div
            key={`${idPrefix}-pair-${oddIdx}`}
            className="grid grid-cols-2 gap-2 sm:gap-3 items-start"
          >
            <GridSlot
              dropId={`${idPrefix}:slot:${oddIdx}`}
              index={oddIdx}
              driver={slots[oddIdx] ? byId.get(slots[oddIdx]!) ?? null : null}
              active={!locked && !!tapDriverId && !slots[oddIdx]}
              isNextTarget={!locked && nextEmptyIndex === oddIdx}
              locked={locked}
              onTap={() => onSlotTap(oddIdx)}
            />
            {evenIdx != null ? (
              <div className="flex flex-col min-w-0">
                <div className={HALF_SLOT_SPACER} aria-hidden />
                <GridSlot
                  dropId={`${idPrefix}:slot:${evenIdx}`}
                  index={evenIdx}
                  driver={slots[evenIdx] ? byId.get(slots[evenIdx]!) ?? null : null}
                  active={!locked && !!tapDriverId && !slots[evenIdx]}
                  isNextTarget={!locked && nextEmptyIndex === evenIdx}
                  locked={locked}
                  onTap={() => onSlotTap(evenIdx)}
                />
              </div>
            ) : (
              <div />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// NEW: Sticky context header wrapper so players don't lose their place on mobile
function DriverPoolPanel({
  pool,
  poolRows,
  tapDriverId,
  placedIds,
  nextEmptyIndex,
  onDriverTap,
}: {
  pool: F1Driver[];
  poolRows: F1Driver[][];
  tapDriverId: string | null;
  placedIds: Set<string>;
  nextEmptyIndex: number;
  onDriverTap: (id: string) => void;
}) {
  return (
    <div className="flex flex-col min-h-0 flex-1 h-full relative">
      <header className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm pb-3 pt-1 border-b border-slate-800/80 mb-2 shrink-0 flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white">Driver pool</h3>
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono">
              {pool.length} remaining · tap or drag
            </p>
          </div>
        </div>
        {nextEmptyIndex !== -1 && (
          <div className="mt-2 flex items-center justify-between bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2 shadow-inner">
            <span className="text-[10px] text-violet-200">Tap driver below for</span>
            <span className="text-xs font-bold text-violet-300 tracking-wider">P{nextEmptyIndex + 1}</span>
          </div>
        )}
      </header>

      <SortableContext items={pool.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        {pool.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center font-mono">
            All grid slots filled
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-h-0 overflow-y-auto pr-0.5 pb-4">
            {poolRows.map((row, rowIdx) => {
              const teamKey =
                row[0]?.constructorId ||
                (row[0] as { constructor_id?: string } | undefined)?.constructor_id ||
                `row-${rowIdx}`;
              return (
                <div
                  key={`pool-team-${teamKey}-${rowIdx}`}
                  className="grid grid-cols-2 gap-1.5 sm:gap-2 items-stretch"
                >
                  {row.map((driver) => (
                    <SortableDriverRow
                      key={driver.id}
                      driver={driver}
                      selected={tapDriverId === driver.id}
                      dimmed={placedIds.has(driver.id)}
                      onTap={() => onDriverTap(driver.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </SortableContext>
    </div>
  );
}

export default function F1GridPredictor({
  drivers,
  onConfirm,
  className = '',
}: F1GridPredictorProps) {
  const [phase, setPhase] = useState<Phase>('quali');
  const [qualiSlots, setQualiSlots] = useState<Slot[]>(() => Array(QUALI_SLOTS).fill(null));
  const [raceSlots, setRaceSlots] = useState<Slot[]>(() => Array(RACE_SLOTS).fill(null));
  const [fastestLap, setFastestLap] = useState<string | null>(null);
  
  const [tapDriverId, setTapDriverId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Quick Offline listener for visual feedback (useOfflineDraft hook handles deeper logic)
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const byId = useMemo(() => new Map(drivers.map((d) => [d.id, d] as const)), [drivers]);

  const qualiLocked = phase === 'race' || phase === 'complete';
  const raceLocked = phase === 'complete';

  const qualiPlaced = useMemo(() => new Set(qualiSlots.filter((id): id is string => !!id)), [qualiSlots]);
  const racePlaced = useMemo(() => new Set(raceSlots.filter((id): id is string => !!id)), [raceSlots]);

  const nextQualiEmpty = useMemo(() => qualiSlots.findIndex((id) => id == null), [qualiSlots]);
  const nextRaceEmpty = useMemo(() => raceSlots.findIndex((id) => id == null), [raceSlots]);

  const pool = useMemo(() => {
    const placed = phase === 'quali' ? qualiPlaced : phase === 'race' ? racePlaced : null;
    if (!placed) return [];

    return drivers
      .filter((d) => !placed.has(d.id))
      .sort((a, b) => {
        const aId = (a.constructorId || '').toLowerCase().trim();
        const bId = (b.constructorId || '').toLowerCase().trim();
        const aTeam = aId === 'rb' ? 'racing_bulls' : aId;
        const bTeam = bId === 'rb' ? 'racing_bulls' : bId;
        const teamDiff =
          (TEAM_SORT_WEIGHT[aTeam] ?? Number.MAX_SAFE_INTEGER) -
          (TEAM_SORT_WEIGHT[bTeam] ?? Number.MAX_SAFE_INTEGER);
        if (teamDiff !== 0) return teamDiff;
        return a.name.localeCompare(b.name);
      });
  }, [drivers, phase, qualiPlaced, racePlaced]);

  const poolRows = useMemo(() => {
    const byTeam = new Map<string, F1Driver[]>();
    for (const d of pool) {
      const raw = (d.constructorId || '').toLowerCase().trim();
      const teamId = raw === 'rb' ? 'racing_bulls' : raw || d.id;
      const list = byTeam.get(teamId);
      if (list) list.push(d);
      else byTeam.set(teamId, [d]);
    }
    return [...byTeam.entries()]
      .sort(
        ([a], [b]) =>
          (TEAM_SORT_WEIGHT[a] ?? Number.MAX_SAFE_INTEGER) -
          (TEAM_SORT_WEIGHT[b] ?? Number.MAX_SAFE_INTEGER),
      )
      .map(([, driversInTeam]) => driversInTeam);
  }, [pool]);

  const qualiFilled = qualiSlots.every(Boolean);
  const raceReady = raceSlots.every(Boolean) && !!fastestLap;

  const placeOnQuali = (driverId: string, slotIndex?: number) => {
    if (qualiLocked) return;
    setQualiSlots((prev) => {
      const next = [...prev];
      const existingIdx = next.findIndex((id) => id === driverId);
      if (existingIdx !== -1) next[existingIdx] = null;
      const target = slotIndex != null ? slotIndex : next.findIndex((id) => id == null);
      if (target === -1) return prev;
      next[target] = driverId;
      return next;
    });
    setTapDriverId(null);
  };

  const placeOnRace = (driverId: string, slotIndex?: number | 'fastest_lap') => {
    if (raceLocked || phase !== 'race') return;
    if (slotIndex === 'fastest_lap') {
      setFastestLap(driverId);
      setTapDriverId(null);
      return;
    }
    setRaceSlots((prev) => {
      const next = [...prev];
      const existingIdx = next.findIndex((id) => id === driverId);
      if (existingIdx !== -1) next[existingIdx] = null;
      const target = slotIndex != null ? slotIndex : next.findIndex((id) => id == null);
      if (target === -1) return prev;
      next[target] = driverId;
      return next;
    });
    setTapDriverId(null);
  };

  const onQualiSlotTap = (slotIndex: number) => {
    if (qualiLocked) return;
    const occupied = qualiSlots[slotIndex];
    if (tapDriverId) {
      placeOnQuali(tapDriverId, slotIndex);
      return;
    }
    if (occupied) {
      // Tap to remove back to pool
      setQualiSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = null;
        return next;
      });
    }
  };

  const onRaceSlotTap = (slotIndex: number | 'fastest_lap') => {
    if (raceLocked || phase !== 'race') return;
    if (slotIndex === 'fastest_lap') {
      if (tapDriverId) {
        placeOnRace(tapDriverId, 'fastest_lap');
        return;
      }
      if (fastestLap) setFastestLap(null);
      return;
    }
    const occupied = raceSlots[slotIndex];
    if (tapDriverId) {
      placeOnRace(tapDriverId, slotIndex);
      return;
    }
    if (occupied) {
      // Tap to remove back to pool
      setRaceSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = null;
        return next;
      });
    }
  };

  const onDriverTap = (driverId: string) => {
    if (phase === 'complete') return;
    if (phase === 'quali') {
      if (qualiPlaced.has(driverId)) return;
      if (nextQualiEmpty !== -1) {
        placeOnQuali(driverId, nextQualiEmpty);
      }
      return;
    }
    if (phase === 'race') {
      if (nextRaceEmpty !== -1) {
        placeOnRace(driverId, nextRaceEmpty);
      } else if (!fastestLap) {
        placeOnRace(driverId, 'fastest_lap');
      }
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    if (phase === 'complete') return;
    setActiveDragId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || phase === 'complete') return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (phase === 'quali' && overId.startsWith('quali:slot:')) {
      const idx = Number(overId.replace('quali:slot:', ''));
      if (Number.isFinite(idx)) placeOnQuali(activeId, idx);
      return;
    }
    if (phase === 'race') {
      if (overId === 'slot:fastest_lap') {
        placeOnRace(activeId, 'fastest_lap');
        return;
      }
      if (overId.startsWith('race:slot:')) {
        const idx = Number(overId.replace('race:slot:', ''));
        if (Number.isFinite(idx)) placeOnRace(activeId, idx);
      }
    }
  };

  const resetActive = () => {
    if (phase === 'quali') {
      setQualiSlots(Array(QUALI_SLOTS).fill(null));
    } else if (phase === 'race') {
      setRaceSlots(Array(RACE_SLOTS).fill(null));
      setFastestLap(null);
    }
    setTapDriverId(null);
  };

  const confirmQuali = () => {
    if (!qualiFilled) return;
    setRaceSlots(Array(RACE_SLOTS).fill(null));
    setFastestLap(null);
    setPhase('race');
    setTapDriverId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmRace = () => {
    if (!raceReady) return;
    setPhase('complete');
    setTapDriverId(null);
    onConfirm?.({
      quali: qualiSlots.filter((id): id is string => !!id),
      race: raceSlots.filter((id): id is string => !!id),
      fastestLap,
    });
  };

  const activeDragDriver = activeDragId ? byId.get(activeDragId) : null;
  const panelClass = 'rounded-2xl border border-slate-800 bg-slate-950/80 p-2.5 sm:p-4 min-w-0 flex flex-col h-full';

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div data-no-swipe="true" className="contents">
      {isOffline && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <CloudOff className="h-4 w-4 shrink-0" />
          <span>Offline mode. Predictions saved locally as a draft.</span>
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6 items-stretch ${className}`}>
        {/* Left — Qualifying */}
        <section className={`${panelClass} ${qualiLocked ? 'ring-1 ring-emerald-500/20' : ''}`}>
          <header className="mb-2 flex items-center justify-between gap-2 shrink-0">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5">
                Qualifying · Top 10
                {qualiLocked && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-emerald-400 uppercase">
                    <Lock className="h-2.5 w-2.5" /> Locked
                  </span>
                )}
              </h3>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono">
                {qualiSlots.filter(Boolean).length}/{QUALI_SLOTS} placed
              </p>
            </div>
            {phase === 'quali' && (
              <button
                type="button"
                onClick={resetActive}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-white transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            )}
          </header>

          <div className="flex-1 min-h-0">
            <StaggeredGrid
              slots={qualiSlots}
              idPrefix="quali"
              byId={byId}
              tapDriverId={phase === 'quali' ? tapDriverId : null}
              nextEmptyIndex={phase === 'quali' ? nextQualiEmpty : -1}
              locked={qualiLocked}
              onSlotTap={onQualiSlotTap}
            />
          </div>

          {phase === 'quali' && (
            <ConfirmPicksButton
              disabled={!qualiFilled}
              onClick={confirmQuali}
              aria-label="Confirm qualifying"
              className="mt-3 w-full shrink-0"
            />
          )}
        </section>

        {/* Right — Pool or Race */}
        <section className={`${panelClass} ${raceLocked ? 'ring-1 ring-emerald-500/20' : ''}`}>
          {phase === 'quali' && (
            <DriverPoolPanel
              pool={pool}
              poolRows={poolRows}
              tapDriverId={tapDriverId}
              placedIds={qualiPlaced}
              nextEmptyIndex={nextQualiEmpty}
              onDriverTap={onDriverTap}
            />
          )}

          {(phase === 'race' || phase === 'complete') && (
            <>
              <header className="mb-2 flex items-center justify-between gap-2 shrink-0">
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5">
                    Race · Top 6
                    {raceLocked && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-emerald-400 uppercase">
                        <Lock className="h-2.5 w-2.5" /> Locked
                      </span>
                    )}
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono">
                    {raceSlots.filter(Boolean).length}/{RACE_SLOTS}
                    {fastestLap ? ' · FL ✓' : ' · FL —'}
                  </p>
                </div>
                {phase === 'race' && (
                  <button
                    type="button"
                    onClick={resetActive}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                )}
              </header>

              <StaggeredGrid
                slots={raceSlots}
                idPrefix="race"
                byId={byId}
                tapDriverId={phase === 'race' ? tapDriverId : null}
                nextEmptyIndex={phase === 'race' ? nextRaceEmpty : -1}
                locked={raceLocked}
                onSlotTap={onRaceSlotTap}
              />

              <FastestLapZone
                driver={fastestLap ? byId.get(fastestLap) ?? null : null}
                active={phase === 'race' && !!tapDriverId && !fastestLap}
                locked={raceLocked}
                onTap={() => onRaceSlotTap('fastest_lap')}
              />

              {phase === 'race' && (
                <>
                  <div className="my-3 border-t border-slate-800 shrink-0" />
                  <DriverPoolPanel
                    pool={pool}
                    poolRows={poolRows}
                    tapDriverId={tapDriverId}
                    placedIds={racePlaced}
                    nextEmptyIndex={nextRaceEmpty}
                    onDriverTap={onDriverTap}
                  />
                  <ConfirmPicksButton
                    disabled={!raceReady}
                    onClick={confirmRace}
                    aria-label="Confirm race card"
                    className="mt-3 w-full shrink-0"
                  />
                </>
              )}
            </>
          )}
        </section>
      </div>
      </div>

      <DragOverlay>
        {activeDragDriver ? (
          <div className="w-56 opacity-95 shadow-2xl cursor-grabbing">
            <F1DriverCard driver={activeDragDriver} selected />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}