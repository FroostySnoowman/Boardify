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
import { useTheme } from '../../theme';
import type { ThemeColors } from '../../theme/colors';

export type TaskDatetimeFieldKey = 'start' | 'due' | 'workManualStart' | 'workManualEnd';

type Props = {
  fieldKey: TaskDatetimeFieldKey;
  label: string;
  valueIso?: string;
  onChangeIso: (iso: string | undefined) => void;
  activeField: TaskDatetimeFieldKey | null;
  onActiveChange: (key: TaskDatetimeFieldKey | null) => void;
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
  const { colors, resolvedScheme } = useTheme();
  const fieldStyles = useMemo(() => createTaskDatetimeFieldStyles(colors), [colors]);
  const webInputStyle = useMemo(
    () =>
      ({
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px 14px',
        fontSize: 16,
        fontWeight: 600,
        color: colors.textPrimary,
        backgroundColor: colors.canvas,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        outline: 'none',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }) as Record<string, string | number>,
    [colors]
  );
  const pickerTheme = resolvedScheme === 'dark' ? ('dark' as const) : ('light' as const);
  const iosPickerTextColor = colors.textPrimary;
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
      <View style={[fieldStyles.block, showDividerTop && fieldStyles.blockDivider]}>
        <Text style={fieldStyles.upperLabel}>{label}</Text>
        <View style={fieldStyles.webRow}>
          <View style={fieldStyles.webInputWrap}>
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
            <Pressable onPress={clear} style={fieldStyles.clearWeb} hitSlop={8}>
              <Text style={fieldStyles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[fieldStyles.block, showDividerTop && fieldStyles.blockDivider]}>
      <Text style={fieldStyles.upperLabel}>{label}</Text>
      <Pressable
        onPress={Platform.OS === 'ios' ? openIos : openAndroid}
        style={({ pressed }) => [fieldStyles.row, pressed && { opacity: 0.92 }]}
      >
        <Text style={[fieldStyles.rowText, !hasValidTaskIso(valueIso) && fieldStyles.rowPlaceholder]}>
          {displayText}
        </Text>
      </Pressable>

      {hasValidTaskIso(valueIso) ? (
        <Pressable onPress={clear} style={fieldStyles.clearNative} hitSlop={8}>
          <Text style={fieldStyles.clearText}>Clear</Text>
        </Pressable>
      ) : null}

      {expanded ? (
        <View style={fieldStyles.iosPanel}>
          <View style={fieldStyles.iosPanelHeader}>
            <Text style={fieldStyles.iosPanelTitle}>Date</Text>
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
              themeVariant={pickerTheme}
              {...(Platform.OS === 'ios' ? { textColor: iosPickerTextColor } : {})}
              style={fieldStyles.picker}
            />
          ) : null}
          <View style={[fieldStyles.iosPanelHeader, fieldStyles.iosPanelHeaderSpaced]}>
            <Text style={fieldStyles.iosPanelTitle}>Time</Text>
            <Pressable onPress={closeIosPanel} hitSlop={10}>
              <Text style={fieldStyles.doneText}>Done</Text>
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
              themeVariant={pickerTheme}
              {...(Platform.OS === 'ios' ? { textColor: iosPickerTextColor } : {})}
              style={fieldStyles.picker}
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

function createTaskDatetimeFieldStyles(colors: ThemeColors) {
  return StyleSheet.create({
    block: {
      marginBottom: 4,
    },
    blockDivider: {
      paddingTop: 14,
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    upperLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors.canvas,
      minHeight: 48,
    },
    rowText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginRight: 10,
    },
    rowPlaceholder: {
      color: colors.placeholder,
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
      color: colors.dangerText,
    },
    iosPanel: {
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.textPrimary,
    },
    doneText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.successEmphasis,
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
}
