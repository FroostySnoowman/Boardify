import React, { useCallback, useEffect, useMemo, useRef, useState, createElement } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const DateTimePickerNative =
  Platform.OS === 'web'
    ? null
    : (require('@react-native-community/datetimepicker').default as typeof import('@react-native-community/datetimepicker').default);
import { hapticLight } from '../../utils/haptics';
import {
  parseTaskDateTime,
  formatTaskDateTimeDisplay,
  hasValidTaskIso,
  toIsoString,
  mergeDatePart,
  mergeTimePart,
  isoToDatetimeLocalInput,
  datetimeLocalInputToIso,
} from '../../utils/taskDateTime';

type FieldKey = 'start' | 'due';

type Props = {
  fieldKey: FieldKey;
  label: string;
  valueIso?: string;
  onChangeIso: (iso: string | undefined) => void;
  activeField: FieldKey | null;
  onActiveChange: (key: FieldKey | null) => void;
  showDividerTop?: boolean;
};

export function TaskDatetimeField({
  fieldKey,
  label,
  valueIso,
  onChangeIso,
  activeField,
  onActiveChange,
  showDividerTop,
}: Props) {
  const expanded = Platform.OS === 'ios' && activeField === fieldKey;
  const [iosDraft, setIosDraft] = useState(() => parseTaskDateTime(valueIso));
  const iosDraftRef = useRef(iosDraft);
  iosDraftRef.current = iosDraft;

  useEffect(() => {
    if (expanded) return;
    const d = parseTaskDateTime(valueIso);
    setIosDraft(d);
    iosDraftRef.current = d;
  }, [valueIso, expanded]);

  const [androidStage, setAndroidStage] = useState<'idle' | 'date' | 'time'>('idle');
  const [androidDraft, setAndroidDraft] = useState(() => parseTaskDateTime(valueIso));

  const displayText = useMemo(() => {
    if (hasValidTaskIso(valueIso)) return formatTaskDateTimeDisplay(valueIso);
    return 'Set date & time';
  }, [valueIso]);

  const openIos = useCallback(() => {
    hapticLight();
    const d = parseTaskDateTime(valueIso);
    iosDraftRef.current = d;
    setIosDraft(d);
    onActiveChange(activeField === fieldKey ? null : fieldKey);
  }, [activeField, fieldKey, onActiveChange, valueIso]);

  const closeIosPanel = useCallback(() => {
    hapticLight();
    onActiveChange(null);
  }, [onActiveChange]);

  const openAndroid = useCallback(() => {
    hapticLight();
    setAndroidDraft(parseTaskDateTime(valueIso));
    setAndroidStage('date');
  }, [valueIso]);

  const onAndroidDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (event.type === 'dismissed') {
        setAndroidStage('idle');
        return;
      }
      if (!date) return;
      setAndroidDraft((prev) => mergeDatePart(prev, date));
      setAndroidStage('time');
    },
    []
  );

  const onAndroidTimeChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (event.type === 'dismissed') {
        setAndroidStage('idle');
        return;
      }
      if (!date) {
        setAndroidStage('idle');
        return;
      }
      hapticLight();
      const merged = mergeTimePart(androidDraft, date);
      onChangeIso(toIsoString(merged));
      setAndroidStage('idle');
    },
    [androidDraft, onChangeIso]
  );

  const clear = useCallback(() => {
    hapticLight();
    onChangeIso(undefined);
    onActiveChange(null);
    setAndroidStage('idle');
  }, [onActiveChange, onChangeIso]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.block, showDividerTop && styles.blockDivider]}>
        <Text style={styles.upperLabel}>{label}</Text>
        <View style={styles.webRow}>
          <View style={styles.webInputWrap}>
            {createElement('input', {
              type: 'datetime-local',
              value: isoToDatetimeLocalInput(valueIso),
              onChange: (e: { target: HTMLInputElement }) => {
                const v = e.target.value;
                onChangeIso(datetimeLocalInputToIso(v));
              },
              style: webInputStyle,
            })}
          </View>
          {hasValidTaskIso(valueIso) ? (
            <Pressable onPress={clear} style={styles.clearWeb} hitSlop={8}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.block, showDividerTop && styles.blockDivider]}>
      <Text style={styles.upperLabel}>{label}</Text>
      <Pressable
        onPress={Platform.OS === 'ios' ? openIos : openAndroid}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}
      >
        <Text style={[styles.rowText, !hasValidTaskIso(valueIso) && styles.rowPlaceholder]}>
          {displayText}
        </Text>
      </Pressable>

      {hasValidTaskIso(valueIso) ? (
        <Pressable onPress={clear} style={styles.clearNative} hitSlop={8}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      ) : null}

      {expanded ? (
        <View style={styles.iosPanel}>
          <View style={styles.iosPanelHeader}>
            <Text style={styles.iosPanelTitle}>Date</Text>
          </View>
          {DateTimePickerNative ? (
            <DateTimePickerNative
              value={iosDraft}
              mode="date"
              display="spinner"
              onChange={(_, date) => {
                if (!date) return;
                const next = mergeDatePart(iosDraftRef.current, date);
                iosDraftRef.current = next;
                setIosDraft(next);
                onChangeIso(toIsoString(next));
              }}
              themeVariant="light"
              {...(Platform.OS === 'ios' ? { textColor: '#0a0a0a' as const } : {})}
              style={styles.picker}
            />
          ) : null}
          <View style={[styles.iosPanelHeader, styles.iosPanelHeaderSpaced]}>
            <Text style={styles.iosPanelTitle}>Time</Text>
            <Pressable onPress={closeIosPanel} hitSlop={10}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
          {DateTimePickerNative ? (
            <DateTimePickerNative
              value={iosDraft}
              mode="time"
              display="spinner"
              onChange={(_, date) => {
                if (!date) return;
                const next = mergeTimePart(iosDraftRef.current, date);
                iosDraftRef.current = next;
                setIosDraft(next);
                onChangeIso(toIsoString(next));
              }}
              themeVariant="light"
              {...(Platform.OS === 'ios' ? { textColor: '#0a0a0a' as const } : {})}
              style={styles.picker}
            />
          ) : null}
        </View>
      ) : null}

      {DateTimePickerNative && androidStage === 'date' ? (
        <DateTimePickerNative
          value={androidDraft}
          mode="date"
          display="default"
          onChange={onAndroidDateChange}
        />
      ) : null}
      {DateTimePickerNative && androidStage === 'time' ? (
        <DateTimePickerNative
          value={androidDraft}
          mode="time"
          display="default"
          onChange={onAndroidTimeChange}
        />
      ) : null}
    </View>
  );
}

const webInputStyle: Record<string, string | number> = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  fontSize: 16,
  fontWeight: 600,
  color: '#0a0a0a',
  backgroundColor: '#f5f0e8',
  border: '1px solid #000',
  borderRadius: 10,
  outline: 'none',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const styles = StyleSheet.create({
  block: {
    marginBottom: 4,
  },
  blockDivider: {
    paddingTop: 14,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  upperLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f5f0e8',
    minHeight: 48,
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0a0a0a',
    marginRight: 10,
  },
  rowPlaceholder: {
    color: '#888',
    fontWeight: '500',
  },
  clearNative: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  clearWeb: {
    marginLeft: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b91c1c',
  },
  iosPanel: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#faf8f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  iosPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iosPanelHeaderSpaced: {
    marginTop: 8,
  },
  iosPanelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#15803d',
  },
  picker: {
    backgroundColor: 'transparent',
    height: 180,
  },
  webRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  webInputWrap: {
    flex: 1,
    minWidth: 0,
  },
});
