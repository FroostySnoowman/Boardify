import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;
import { formatBirthdateForApi, toLocalDateOnly } from '../utils/birthdate';

interface BirthdatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  style?: object;
}

export function BirthdatePicker({
  value,
  onChange,
  maximumDate = new Date(),
  minimumDate = new Date(new Date().getFullYear() - 120, 0, 1),
  style,
}: BirthdatePickerProps) {
  if (Platform.OS === 'web') {
    const minStr = formatBirthdateForApi(minimumDate);
    const maxStr = formatBirthdateForApi(maximumDate);
    const validValue = value && !isNaN(value.getTime());
    const valueStr = validValue ? formatBirthdateForApi(value) : '';
    return (
      <View style={[styles.webContainer, style]}>
        <input
          type="date"
          value={valueStr}
          min={minStr}
          max={maxStr}
          onChange={(e) => {
            const v = (e.target as HTMLInputElement).value;
            if (!v) return;
            const parsed = new Date(v + 'T00:00:00');
            if (!isNaN(parsed.getTime())) {
              onChange(toLocalDateOnly(parsed));
            }
          }}
          style={webInputStyle}
        />
      </View>
    );
  }

  if (!DateTimePicker) return null;
  return (
    <DateTimePicker
      value={value}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      maximumDate={maximumDate}
      minimumDate={minimumDate}
      onChange={(_: any, date?: Date) => date && onChange(toLocalDateOnly(date))}
      textColor="#ffffff"
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  webContainer: {
    width: '100%',
    minHeight: 44,
  },
});

const webInputStyle: Record<string, string | number> = {
  width: '100%',
  padding: '12px 16px',
  fontSize: 16,
  color: '#ffffff',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: 8,
  minHeight: 44,
  colorScheme: 'dark',
  cursor: 'pointer',
  outline: 'none',
};
