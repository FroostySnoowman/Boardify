import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { BoardCardData, TaskWorkLogEntry } from '../../types/board';
import { hapticLight } from '../../utils/haptics';
import {
  formatStopwatchMs,
  formatLoggedTotalMs,
  formatTotalTrackedBanner,
  durationFromIsoRange,
  toggleStopwatchOnTask,
} from '../../utils/workTime';
import { formatTaskDateTimeDisplay, hasValidTaskIso } from '../../utils/taskDateTime';
import { TaskDatetimeField, type TaskDatetimeFieldKey } from './TaskDatetimeField';

function uid() {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const WEB_POINTER = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : {};

const SHIFT = 5;

type Props = {
  task: BoardCardData;
  onChange: (next: BoardCardData) => void;
  activeField: TaskDatetimeFieldKey | null;
  onActiveChange: (key: TaskDatetimeFieldKey | null) => void;
};

export function TaskWorkTimeSection({ task, onChange, activeField, onActiveChange }: Props) {
  const [tick, setTick] = useState(0);
  const [manualStartIso, setManualStartIso] = useState<string | undefined>();
  const [manualEndIso, setManualEndIso] = useState<string | undefined>();
  const [historyOpen, setHistoryOpen] = useState(false);

  const running = task.workTimerRunStartedAtMs != null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const sessionMs = useMemo(() => {
    const start = task.workTimerRunStartedAtMs;
    if (start == null) return 0;
    return Date.now() - start;
  }, [task.workTimerRunStartedAtMs, tick]);

  const loggedFromEntriesMs = useMemo(
    () => (task.workLog ?? []).reduce((a, e) => a + e.durationMs, 0),
    [task.workLog]
  );

  const totalTrackedMs = loggedFromEntriesMs + sessionMs;

  const startPause = useCallback(() => {
    hapticLight();
    onChange(toggleStopwatchOnTask(task));
  }, [task, onChange]);

  const resetTimer = useCallback(() => {
    hapticLight();
    onChange({
      ...task,
      workTimerAccumMs: 0,
      workTimerRunStartedAtMs: undefined,
    });
  }, [task, onChange]);

  const addManualEntry = useCallback(() => {
    if (!hasValidTaskIso(manualStartIso) || !hasValidTaskIso(manualEndIso)) return;
    const durationMs = durationFromIsoRange(manualStartIso!, manualEndIso!);
    if (durationMs == null || durationMs < 60000) {
      hapticLight();
      return;
    }
    hapticLight();
    const entry: TaskWorkLogEntry = {
      id: uid(),
      durationMs,
      source: 'manual',
      startIso: manualStartIso,
      endIso: manualEndIso,
      createdAtIso: new Date().toISOString(),
    };
    onChange({
      ...task,
      workLog: [...(task.workLog ?? []), entry],
    });
    setManualStartIso(undefined);
    setManualEndIso(undefined);
    onActiveChange(null);
  }, [task, onChange, manualStartIso, manualEndIso, onActiveChange]);

  const removeEntry = useCallback(
    (id: string) => {
      hapticLight();
      onChange({
        ...task,
        workLog: (task.workLog ?? []).filter((e) => e.id !== id),
      });
    },
    [task, onChange]
  );

  const log = task.workLog ?? [];
  const manualDurationMs =
    hasValidTaskIso(manualStartIso) && hasValidTaskIso(manualEndIso)
      ? durationFromIsoRange(manualStartIso!, manualEndIso!)
      : null;
  const canAddManual = manualDurationMs != null && manualDurationMs >= 60000;

  const manualPreview = useMemo(() => {
    if (!hasValidTaskIso(manualStartIso) || !hasValidTaskIso(manualEndIso)) return null;
    if (manualDurationMs == null || manualDurationMs <= 0) {
      return { text: 'End must be after start.', ok: false as const };
    }
    if (manualDurationMs < 60000) {
      return { text: 'Need at least 1 minute.', ok: false as const };
    }
    return {
      text: `Adds ${formatLoggedTotalMs(manualDurationMs)} to your total.`,
      ok: true as const,
    };
  }, [manualStartIso, manualEndIso, manualDurationMs]);

  return (
    <View>
      <View style={styles.totalBanner}>
        <Text style={styles.totalValue} numberOfLines={2} adjustsFontSizeToFit>
          {formatTotalTrackedBanner(totalTrackedMs)}
        </Text>
        <Text style={styles.totalCaption}>Total time on this card</Text>
      </View>

      <View style={styles.stopwatchCard}>
        <View style={styles.timerRow}>
          <Text style={styles.timerDigits} numberOfLines={1} adjustsFontSizeToFit>
            {formatStopwatchMs(sessionMs)}
          </Text>
          <View style={[styles.statusPill, running ? styles.statusOn : styles.statusOff]}>
            <View style={[styles.statusDot, running && styles.statusDotOn]} />
            <Text style={styles.statusText}>{running ? 'Running' : 'Paused'}</Text>
          </View>
        </View>
        <Pressable
          onPress={startPause}
          accessibilityRole="button"
          accessibilityLabel={running ? 'Pause timer' : 'Start timer'}
          style={[styles.mainActionPressable, WEB_POINTER]}
        >
          {({ pressed }) => (
            <View style={styles.neuBtnStack}>
              <View style={styles.neuBtnShadow} />
              <View
                style={[
                  styles.neuBtnFace,
                  pressed && styles.neuBtnFacePressed,
                  pressed && styles.neuBtnFacePressDim,
                ]}
              >
                <Feather name={running ? 'pause' : 'play'} size={20} color="#0a0a0a" />
                <Text style={styles.neuBtnFaceText}>{running ? 'Pause' : 'Start'}</Text>
              </View>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={resetTimer}
          disabled={sessionMs === 0 && !running}
          style={({ pressed }) => [
            styles.resetBtn,
            (sessionMs === 0 && !running) && styles.halfBtnDisabled,
            pressed && sessionMs > 0 && styles.halfBtnPressed,
            WEB_POINTER,
          ]}
        >
          <Text style={styles.halfBtnText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.manualCard}>
        <Text style={styles.manualTitle}>Or add a time range</Text>
        <TaskDatetimeField
          fieldKey="workManualStart"
          label="From"
          valueIso={manualStartIso}
          onChangeIso={setManualStartIso}
          activeField={activeField}
          onActiveChange={onActiveChange}
        />
        <TaskDatetimeField
          fieldKey="workManualEnd"
          label="To"
          valueIso={manualEndIso}
          onChangeIso={setManualEndIso}
          activeField={activeField}
          onActiveChange={onActiveChange}
          showDividerTop
        />
        {manualPreview ? (
          <Text style={manualPreview.ok ? styles.manualPreviewOk : styles.manualPreviewErr}>
            {manualPreview.text}
          </Text>
        ) : null}
        <Pressable
          onPress={addManualEntry}
          disabled={!canAddManual}
          accessibilityRole="button"
          accessibilityLabel="Add manual time range to log"
          style={[styles.manualAddPressable, WEB_POINTER]}
        >
          {({ pressed }) => (
            <View style={styles.neuBtnStack}>
              <View style={[styles.neuBtnShadow, !canAddManual && styles.neuBtnShadowMuted]} />
              <View
                style={[
                  styles.neuBtnFace,
                  styles.neuBtnFaceCompact,
                  !canAddManual && styles.neuBtnFaceDisabled,
                  pressed && canAddManual && styles.neuBtnFacePressed,
                  pressed && canAddManual && styles.neuBtnFacePressDim,
                ]}
              >
                <Text style={[styles.neuBtnFaceText, styles.neuBtnManualText, !canAddManual && styles.neuBtnManualTextDisabled]}>
                  Add to log
                </Text>
              </View>
            </View>
          )}
        </Pressable>
      </View>

      {log.length > 0 ? (
        <View style={styles.logBlock}>
          <Pressable
            onPress={() => {
              hapticLight();
              setHistoryOpen((o) => !o);
            }}
            accessibilityRole="button"
            accessibilityLabel={historyOpen ? 'Collapse history' : `Expand history, ${log.length} entries`}
            style={({ pressed }) => [styles.logHeaderPressable, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.logHeaderTitleRow}>
              <Text style={styles.logHeading}>
                History <Text style={styles.logCount}>({log.length})</Text>
              </Text>
              <Feather name={historyOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
            </View>
          </Pressable>
          {historyOpen
            ? log
                .slice()
                .reverse()
                .map((e) => (
                  <View key={e.id} style={styles.logRow}>
                    <View style={styles.logMeta}>
                      <Text style={styles.logDuration}>{formatTotalTrackedBanner(e.durationMs)}</Text>
                      <Text style={styles.logSub} numberOfLines={2}>
                        {e.source === 'stopwatch'
                          ? `Stopwatch · ${formatTaskDateTimeDisplay(e.createdAtIso)}`
                          : e.startIso && e.endIso
                            ? `${formatTaskDateTimeDisplay(e.startIso)} → ${formatTaskDateTimeDisplay(e.endIso)}`
                            : 'Manual'}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeEntry(e.id)} hitSlop={10} style={styles.logTrash}>
                      <Feather name="trash-2" size={17} color="#b91c1c" />
                    </Pressable>
                  </View>
                ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  totalBanner: {
    marginBottom: 14,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0a0a0a',
    letterSpacing: -0.3,
  },
  totalCaption: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
    marginTop: 2,
  },
  stopwatchCard: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 14,
    marginBottom: 14,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  timerDigits: {
    flex: 1,
    fontSize: 32,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    color: '#0a0a0a',
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusOn: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
  },
  statusOff: {
    backgroundColor: '#f5f5f5',
    borderColor: '#d4d4d4',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#a3a3a3',
  },
  statusDotOn: {
    backgroundColor: '#059669',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#404040',
  },
  mainActionPressable: {
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 10,
  },
  neuBtnStack: {
    position: 'relative',
    alignSelf: 'stretch',
    width: '100%',
    marginRight: SHIFT,
    marginBottom: SHIFT,
  },
  neuBtnShadow: {
    position: 'absolute',
    left: SHIFT,
    top: SHIFT,
    right: -SHIFT,
    bottom: -SHIFT,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  neuBtnShadowMuted: {
    backgroundColor: '#e8e8e8',
  },
  neuBtnFace: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f5f0e8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  neuBtnFaceCompact: {
    paddingVertical: 13,
    minHeight: 48,
  },
  neuBtnFaceDisabled: {
    backgroundColor: '#f0f0f0',
  },
  neuBtnFacePressed: {
    transform: [{ translateX: SHIFT }, { translateY: SHIFT }],
  },
  neuBtnFacePressDim: {
    opacity: 0.88,
  },
  neuBtnFaceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  neuBtnManualText: {
    fontSize: 15,
  },
  neuBtnManualTextDisabled: {
    color: '#9ca3af',
    fontWeight: '700',
  },
  resetBtn: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfBtnDisabled: {
    opacity: 0.4,
  },
  halfBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  halfBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  halfBtnTextEmphasis: {
    fontWeight: '800',
  },
  manualCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 12,
    paddingBottom: 14,
    marginBottom: 4,
  },
  manualTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a0a0a',
    marginBottom: 10,
  },
  manualPreviewOk: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803d',
    marginTop: 4,
    marginBottom: 10,
  },
  manualPreviewErr: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b45309',
    marginTop: 4,
    marginBottom: 10,
  },
  manualAddPressable: {
    alignSelf: 'stretch',
    width: '100%',
  },
  logBlock: {
    marginTop: 12,
    paddingTop: 4,
  },
  logHeaderPressable: {
    paddingVertical: 6,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  logHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logCount: {
    fontWeight: '700',
    color: '#aaa',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  logMeta: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  logDuration: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  logSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },
  logTrash: {
    padding: 4,
  },
});
