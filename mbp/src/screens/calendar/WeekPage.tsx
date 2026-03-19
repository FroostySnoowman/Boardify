import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { EventType } from '../../api/calendar';
import { formatMinutesForDisplay, formatHourLabel } from '../../utils/dateUtils';

type WeekPageProps = {
  currentDate: Date;
  events: EventType[];
  onPrevWeek(): void;
  onNextWeek(): void;
  onOpenDay(day: number | Date): void;
  onEventClick(event: EventType): void;
};

function parseTime(timeStr: string): { start: number; end: number } | null {
  const parts = timeStr.split(' - ');
  const startStr = parts[0] || timeStr;
  
  const parseTimeStr = (str: string): number => {
    const trimmed = str.trim().toUpperCase();
    const isPM = trimmed.includes('PM') && !trimmed.includes('12');
    const isAM = trimmed.includes('AM');
    const match = trimmed.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    if (isPM && hours !== 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  };
  
  const start = parseTimeStr(startStr);
  const end = parts[1] ? parseTimeStr(parts[1]) : start + 60;
  
  return { start, end };
}

const formatMinutes = formatMinutesForDisplay;

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function WeekPage({
  currentDate,
  events,
  onPrevWeek,
  onNextWeek,
  onOpenDay,
  onEventClick
}: WeekPageProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  useEffect(() => {
    const scrollTo6am = () => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 360, animated: false });
      }
    };
    
    setTimeout(scrollTo6am, 100);
  }, [currentDate]);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const now = new Date();
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
  const currentDayIndex = weekDates.findIndex(d => d.toDateString() === today.toDateString());

  const dayEvents = useMemo(() => {
    return weekDates.map(date => {
      const dateStr = formatDate(date);
      const dayEvents = events.filter(e => e.date === dateStr);
      
      return dayEvents
        .map(event => {
          const timeData = parseTime(event.time);
          if (!timeData) return null;
          
          return {
            ...event,
            startMinutes: timeData.start,
            endMinutes: timeData.end,
            duration: timeData.end - timeData.start,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .sort((a, b) => a.startMinutes - b.startMinutes);
    });
  }, [events, weekDates]);

  const groupedEvents = useMemo(() => {
    return dayEvents.map(events => {
      if (events.length === 0) return [];
      
      type EventWithTime = typeof events[0];
      const groups: EventWithTime[][] = [];
      let currentGroup: EventWithTime[] = [];
      let currentEnd = 0;
      
      events.forEach(event => {
        if (event.startMinutes >= currentEnd) {
          if (currentGroup.length > 0) {
            groups.push(currentGroup);
          }
          currentGroup = [event];
          currentEnd = event.endMinutes;
        } else {
          currentGroup.push(event);
          currentEnd = Math.max(currentEnd, event.endMinutes);
        }
      });
      
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      
      return groups;
    });
  }, [dayEvents]);

  const getEventColor = (event: EventType): string => {
    if (event.color) {
      const match = event.color.match(/bg-(\w+)-(\d+)/);
      if (match) {
        const colorMap: Record<string, string> = {
          red: '#ef4444',
          blue: '#3b82f6',
          green: '#22c55e',
          purple: '#a855f7',
          yellow: '#eab308',
          gray: '#6b7280',
        };
        return colorMap[match[1]] || '#3b82f6';
      }
    }
    const typeColors: Record<string, string> = {
      match: '#ef4444',
      practice: '#3b82f6',
      tournament: '#a855f7',
      other: '#6b7280',
    };
    return typeColors[event.type] || '#3b82f6';
  };

  const getEventStyle = (event: typeof dayEvents[0][0]) => {
    const hourHeight = 60;
    const startHour = 0;
    const top = ((event.startMinutes - startHour * 60) / 60) * hourHeight;
    const height = (event.duration / 60) * hourHeight;
    
    return {
      position: 'absolute' as const,
      top: Math.max(0, top),
      left: 0,
      right: 0,
      height: Math.max(20, height),
      backgroundColor: getEventColor(event),
      borderRadius: 4,
      padding: 4,
      paddingLeft: 6,
      minHeight: 20,
    };
  };

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekRange = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onPrevWeek} style={styles.navButton}>
          <Feather name="chevron-left" size={20} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.monthYear}>{monthYear}</Text>
          <Text style={styles.weekRange}>{weekRange}</Text>
        </View>
        <TouchableOpacity onPress={onNextWeek} style={styles.navButton}>
          <Feather name="chevron-right" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.dayHeaders}>
        <View style={styles.timeColumnHeader} />
        {weekDates.map((date, index) => {
          const isToday = date.toDateString() === today.toDateString();
          return (
            <TouchableOpacity
              key={date.toString()}
              style={[styles.dayHeader, isToday && styles.todayHeader]}
              onPress={() => onOpenDay(date)}
            >
              <Text style={[styles.dayOfWeek, isToday && styles.todayText]}>
                {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
              </Text>
              <Text style={[styles.dayNumber, isToday && styles.todayText]}>
                {date.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={styles.timeGrid}>
          <View style={styles.timeLabels}>
            {hours.map(hour => (
              <View key={hour} style={styles.hourRow}>
                <Text style={styles.timeLabel} numberOfLines={1}>
                  {formatHourLabel(hour)}
                </Text>
              </View>
            ))}
          </View>

          {weekDates.map((date, dayIndex) => {
            const isToday = date.toDateString() === today.toDateString();
            const eventGroups = groupedEvents[dayIndex];
            
            return (
              <View key={date.toString()} style={styles.dayColumn}>
                {hours.map(hour => (
                  <View
                    key={hour}
                    style={[
                      styles.gridLine,
                      { top: hour * 60 },
                      isToday && styles.todayGridLine,
                    ]}
                  />
                ))}
                
                {isToday && currentTimeMinutes >= 0 && currentTimeMinutes <= 23 * 60 + 59 && (
                  <View
                    style={[
                      styles.currentTimeLine,
                      { top: (currentTimeMinutes / 60) * 60 },
                    ]}
                  >
                    <View style={styles.currentTimeDot} />
                    <View style={styles.currentTimeLineBar} />
                  </View>
                )}
                
                {eventGroups.map((group, groupIndex) => {
                  const firstEvent = group[0];
                  const top = (firstEvent.startMinutes / 60) * 60;
                  const maxEnd = Math.max(...group.map(e => e.endMinutes));
                  const height = ((maxEnd - firstEvent.startMinutes) / 60) * 60;
                  
                  return (
                    <View
                      key={groupIndex}
                      style={[
                        styles.eventGroupContainer,
                        {
                          top: Math.max(0, top),
                          height: Math.max(20, height),
                        },
                      ]}
                    >
                      {group.map((event, eventIndex) => {
                        const eventHeight = (event.duration / 60) * 60;
                        return (
                          <TouchableOpacity
                            key={event.id}
                            style={[
                              styles.eventBlock,
                              {
                                flex: 1,
                                backgroundColor: getEventColor(event),
                                marginRight: eventIndex < group.length - 1 ? 2 : 0,
                              },
                            ]}
                            onPress={() => onEventClick(event)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.eventTitle} numberOfLines={1}>
                              {event.title}
                            </Text>
                            <Text style={styles.eventTime} numberOfLines={1}>
                              {formatMinutes(event.startMinutes)} - {formatMinutes(event.endMinutes)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 2,
  },
  monthYear: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  weekRange: {
    fontSize: 12,
    color: '#9ca3af',
  },
  dayHeaders: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  timeColumnHeader: {
    width: 68,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  todayHeader: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  dayOfWeek: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  todayText: {
    color: '#3b82f6',
  },
  scrollView: {
    flex: 1,
  },
  timeGrid: {
    flexDirection: 'row',
    minHeight: 24 * 60,
  },
  timeLabels: {
    width: 68,
    paddingRight: 8,
  },
  hourRow: {
    height: 60,
    paddingTop: 4,
  },
  timeLabel: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'right',
    width: 58,
  },
  dayColumn: {
    flex: 1,
    position: 'relative',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  todayGridLine: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTimeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginLeft: -5,
  },
  currentTimeLineBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#ef4444',
  },
  eventGroupContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 2,
  },
  eventBlock: {
    borderRadius: 4,
    padding: 4,
    paddingLeft: 6,
    minHeight: 20,
  },
  eventTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventTime: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
  },
});
