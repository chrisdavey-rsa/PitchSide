/**
 * F1 multi-stage grid predictor.
 * Phase 1 — Qualifying Top 10 (left) + Driver Pool (right)
 * Phase 2 — Locked Quali (left) + Race Top 6 + Fastest Lap + Pool (right)
 * Phase 3 — Locked Quali (left) + Locked Race (right)
 */

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
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
import { Lock, RotateCcw, Timer } from 'lucide-react';
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
const SLOT_MIN_H = 'min-h-[5.25rem]';
/** Half of slot min-height — places even grid slot halfway down its odd partner. */
const HALF_SLOT_SPACER = 'h-[2.625rem] shrink-0';
/** Gap between pair groups so P2 sits clearly ahead of P3. */
const PAIR_GAP = 'gap-y-5';

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
    <div className="flex flex-col items-center text-center gap-1 min-w-0 w-full py-1">
      <F1HelmetIcon colorHex={driver.teamColorHex} className="h-9 w-9 shrink-0" />
      <div className="min-w-0 w-full px-0.5">
        <div className="text-[11px] font-semibold text-slate-100 truncate leading-tight">
          {driver.name}
        </div>
        <div className="text-[9px] font-mono text-slate-500 truncate leading-tight">
          {driver.constructorName ?? '—'}
        </div>
        <div className="text-[10px] font-mono text-slate-400 tabular-nums">
          #{driver.permanentNumber ?? '—'}
        </div>
      </div>
    </div>
  );
}

function GridSlot({
  dropId,
  index,
  driver,
  active,
  locked,
  onTap,
}: {
  dropId: string;
  index: number;
  driver: F1Driver | null;
  active: boolean;
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
      className={`relative flex flex-col items-stretch rounded-xl border px-2 py-2 text-left transition-all ${SLOT_MIN_H} w-full ${
        locked
          ? 'border-emerald-500/30 bg-slate-900/90 cursor-default'
          : isOver || active
            ? 'border-violet-400 bg-violet-500/20 ring-1 ring-violet-400/40'
            : driver
              ? 'border-slate-600 bg-slate-900'
              : 'border-dashed border-slate-700 bg-slate-950/60 hover:border-slate-500'
      }`}
    >
      <span className="font-mono text-[10px] text-slate-500 self-start mb-0.5 flex items-center gap-1">
        P{pos}
        {locked && <Lock className="h-2.5 w-2.5 text-emerald-400/80" />}
      </span>
      {driver ? (
        <PlacedDriverTile driver={driver} />
      ) : (
        <span className="flex-1 flex items-center justify-center text-[11px] text-slate-600">
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
      className={`mt-3 w-full rounded-2xl border-2 px-3 py-3 transition-all ${
        locked
          ? 'border-amber-500/40 bg-amber-500/10 cursor-default'
          : isOver || active
            ? 'border-amber-300 bg-amber-500/20 shadow-[0_0_28px_rgba(251,191,36,0.45)]'
            : driver
              ? 'border-amber-400/70 bg-amber-500/10 shadow-[0_0_20px_rgba(251,191,36,0.28)]'
              : 'border-amber-500/40 bg-slate-950/80 shadow-[0_0_18px_rgba(251,191,36,0.15)] hover:border-amber-400/60'
      }`}
    >
      <div className="flex items-center justify-center gap-2 text-amber-300 mb-1.5">
        <Timer className={`h-4 w-4 ${locked ? '' : 'animate-pulse'}`} />
        <span className="text-xs font-mono font-bold uppercase tracking-wider">
          Fastest Lap
        </span>
        {locked && <Lock className="h-3 w-3 text-amber-300/80" />}
      </div>
      {driver ? (
        <PlacedDriverTile driver={driver} />
      ) : (
        <p className="text-[11px] text-amber-200/60 text-center font-mono">
          Drop any driver — stopwatch prediction
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
      className="mb-3 h-3 w-full rounded-sm overflow-hidden border border-slate-600/80 shadow-inner"
      style={{
        backgroundImage:
          'repeating-conic-gradient(#0f172a 0% 25%, #f8fafc 0% 50%)',
        backgroundSize: '12px 12px',
      }}
    />
  );
}

function StaggeredGrid({
  slots,
  idPrefix,
  byId,
  tapDriverId,
  locked,
  onSlotTap,
}: {
  slots: Slot[];
  idPrefix: 'quali' | 'race';
  byId: Map<string, F1Driver>;
  tapDriverId: string | null;
  locked?: boolean;
  onSlotTap: (index: number) => void;
}) {
  // Pair (P1,P2), (P3,P4), … — even slot starts halfway down its odd partner.
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
            className="grid grid-cols-2 gap-3 items-start"
          >
            <GridSlot
              dropId={`${idPrefix}:slot:${oddIdx}`}
              index={oddIdx}
              driver={
                slots[oddIdx] ? byId.get(slots[oddIdx]!) ?? null : null
              }
              active={!locked && !!tapDriverId && !slots[oddIdx]}
              locked={locked}
              onTap={() => onSlotTap(oddIdx)}
            />
            {evenIdx != null ? (
              <div className="flex flex-col min-w-0">
                <div className={HALF_SLOT_SPACER} aria-hidden />
                <GridSlot
                  dropId={`${idPrefix}:slot:${evenIdx}`}
                  index={evenIdx}
                  driver={
                    slots[evenIdx]
                      ? byId.get(slots[evenIdx]!) ?? null
                      : null
                  }
                  active={!locked && !!tapDriverId && !slots[evenIdx]}
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

function DriverPoolPanel({
  pool,
  poolColumns,
  tapDriverId,
  placedIds,
  onDriverTap,
}: {
  pool: F1Driver[];
  poolColumns: readonly [F1Driver[], F1Driver[]];
  tapDriverId: string | null;
  placedIds: Set<string>;
  onDriverTap: (id: string) => void;
}) {
  return (
    <div className="flex flex-col min-h-0 flex-1 h-full">
      <header className="mb-3 shrink-0">
        <h3 className="text-sm font-semibold text-white">Driver pool</h3>
        <p className="text-[10px] text-slate-500 font-mono">
          {pool.length} remaining · drag onto the grid
        </p>
      </header>
      <SortableContext
        items={pool.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        {pool.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            All drivers are placed.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 items-start flex-1 min-h-0 overflow-y-auto pr-0.5">
            {poolColumns.map((col, colIdx) => (
              <div
                key={`pool-col-${colIdx}`}
                className="flex flex-col gap-2 min-w-0"
              >
                {col.map((driver) => (
                  <SortableDriverRow
                    key={driver.id}
                    driver={driver}
                    selected={tapDriverId === driver.id}
                    dimmed={placedIds.has(driver.id)}
                    onTap={() => onDriverTap(driver.id)}
                  />
                ))}
              </div>
            ))}
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
  const [qualiSlots, setQualiSlots] = useState<Slot[]>(() =>
    Array(QUALI_SLOTS).fill(null),
  );
  const [raceSlots, setRaceSlots] = useState<Slot[]>(() =>
    Array(RACE_SLOTS).fill(null),
  );
  const [fastestLap, setFastestLap] = useState<string | null>(null);
  const [tapDriverId, setTapDriverId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  );

  const byId = useMemo(
    () => new Map(drivers.map((d) => [d.id, d] as const)),
    [drivers],
  );

  const qualiLocked = phase === 'race' || phase === 'complete';
  const raceLocked = phase === 'complete';

  const qualiPlaced = useMemo(
    () => new Set(qualiSlots.filter((id): id is string => !!id)),
    [qualiSlots],
  );
  const racePlaced = useMemo(
    () => new Set(raceSlots.filter((id): id is string => !!id)),
    [raceSlots],
  );

  const pool = useMemo(() => {
    if (phase === 'quali') {
      return drivers.filter((d) => !qualiPlaced.has(d.id));
    }
    if (phase === 'race') {
      return drivers.filter((d) => !racePlaced.has(d.id));
    }
    return [];
  }, [drivers, phase, qualiPlaced, racePlaced]);

  const poolColumns = useMemo(() => {
    const mid = Math.ceil(pool.length / 2);
    return [pool.slice(0, mid), pool.slice(mid)] as const;
  }, [pool]);

  const qualiFilled = qualiSlots.every(Boolean);
  const raceReady = raceSlots.every(Boolean) && !!fastestLap;

  const placeOnQuali = (driverId: string, slotIndex?: number) => {
    if (qualiLocked) return;
    setQualiSlots((prev) => {
      const next = [...prev];
      const existingIdx = next.findIndex((id) => id === driverId);
      if (existingIdx !== -1) next[existingIdx] = null;
      const target =
        slotIndex != null ? slotIndex : next.findIndex((id) => id == null);
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
      const target =
        slotIndex != null ? slotIndex : next.findIndex((id) => id == null);
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
      if (raceSlots.every(Boolean) && !fastestLap) {
        setTapDriverId(occupied);
        return;
      }
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
      if (tapDriverId === driverId) {
        placeOnQuali(driverId);
        return;
      }
      const empty = qualiSlots.findIndex((id) => id == null);
      if (empty !== -1 && !tapDriverId) {
        placeOnQuali(driverId, empty);
        return;
      }
      setTapDriverId(driverId);
      return;
    }
    // race
    if (tapDriverId === driverId) {
      if (!fastestLap) {
        placeOnRace(driverId, 'fastest_lap');
        return;
      }
      placeOnRace(driverId);
      return;
    }
    if (!racePlaced.has(driverId)) {
      const empty = raceSlots.findIndex((id) => id == null);
      if (empty !== -1 && !tapDriverId) {
        placeOnRace(driverId, empty);
        return;
      }
    }
    setTapDriverId(driverId);
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

  const panelClass =
    'rounded-2xl border border-slate-800 bg-slate-950/80 p-3 sm:p-4 min-w-0 flex flex-col h-full';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-stretch ${className}`}
      >
        {/* Left — Qualifying (interactive → locked) */}
        <section className={`${panelClass} ${qualiLocked ? 'ring-1 ring-emerald-500/20' : ''}`}>
          <header className="mb-3 flex items-center justify-between gap-2 shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Qualifying · Top 10
                {qualiLocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 uppercase">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">
                {qualiSlots.filter(Boolean).length}/{QUALI_SLOTS} placed
              </p>
            </div>
            {phase === 'quali' && (
              <button
                type="button"
                onClick={resetActive}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-white"
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
              locked={qualiLocked}
              onSlotTap={onQualiSlotTap}
            />
          </div>

          {phase === 'quali' && (
            <ConfirmPicksButton
              disabled={!qualiFilled}
              onClick={confirmQuali}
              aria-label="Confirm qualifying"
              className="mt-4 w-full shrink-0"
            />
          )}
        </section>

        {/* Right — Pool → Race+Pool → Locked Race */}
        <section className={`${panelClass} ${raceLocked ? 'ring-1 ring-emerald-500/20' : ''}`}>
          {phase === 'quali' && (
            <DriverPoolPanel
              pool={pool}
              poolColumns={poolColumns}
              tapDriverId={tapDriverId}
              placedIds={qualiPlaced}
              onDriverTap={onDriverTap}
            />
          )}

          {(phase === 'race' || phase === 'complete') && (
            <>
              <header className="mb-3 flex items-center justify-between gap-2 shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    Race · Top 6
                    {raceLocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 uppercase">
                        <Lock className="h-3 w-3" /> Locked
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {raceSlots.filter(Boolean).length}/{RACE_SLOTS}
                    {fastestLap ? ' · FL ✓' : ' · FL —'}
                  </p>
                </div>
                {phase === 'race' && (
                  <button
                    type="button"
                    onClick={resetActive}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-white"
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
                  <div className="my-4 border-t border-slate-800 shrink-0" />
                  <DriverPoolPanel
                    pool={pool}
                    poolColumns={poolColumns}
                    tapDriverId={tapDriverId}
                    placedIds={racePlaced}
                    onDriverTap={onDriverTap}
                  />
                  <ConfirmPicksButton
                    disabled={!raceReady}
                    onClick={confirmRace}
                    aria-label="Confirm race card"
                    className="mt-4 w-full shrink-0"
                  />
                </>
              )}
            </>
          )}
        </section>
      </div>

      <DragOverlay>
        {activeDragDriver ? (
          <div className="w-64 opacity-95 shadow-2xl cursor-grabbing">
            <F1DriverCard driver={activeDragDriver} selected />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
