import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, SectionList, ScrollView, NativeSyntheticEvent, NativeScrollEvent, ViewToken, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EventType } from '../../api/calendar';
import { parseLocalDate, parseLocalDateTime, formatTimeForDisplay } from '../../utils/dateUtils';

const SECTION_HEADER_HEIGHT = 44;
const LIST_GROUP_GAP = 24;

export type CalendarSection = { title: string; dateKey: string; data: EventType[] };

interface ListPageProps {
  events: EventType[];
  onEventClick: (event: EventType) => void;
  currentUserId: number;
  rsvps: Record<number | string, { yes: string[]; no: string[] }>;
  onRSVP: (eventId: number | string, response: 'yes' | 'no') => void;
  listRef?: React.RefObject<SectionList<EventType, CalendarSection> | null>;
  onEndReached?: () => void;
  onStartReached?: () => void;
  onNextEventSectionVisible?: (visible: boolean) => void;
  onListReady?: () => void;
  onContentSizeChange?: (w: number, h: number) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  contentContainerStyle?: object;
  showReturnButton?: boolean;
  onReturnToUpcoming?: () => void;
}

function getDateLabel(dateStr: string, today: Date): string {
  const eventDate = parseLocalDate(dateStr);
  if (eventDate.toDateString() === today.toDateString()) return 'Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (eventDate.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function getEventTypeColor(type: string): string | undefined {
  switch (type) {
    case 'match': return 'bg-green-500';
    case 'practice': return 'bg-blue-500';
    case 'tournament': return undefined;
    default: return 'bg-gray-500';
  }
}

function getEventTypeStyle(type: string): { backgroundColor?: string } {
  if (type === 'tournament') return { backgroundColor: 'rgba(253, 224, 71, 0.75)' };
  return {};
}

function EventCard({
  event,
  rsvps,
  currentUserId,
  onEventClick,
  onRSVP,
}: {
  event: EventType;
  rsvps: Record<number | string, { yes: string[]; no: string[] }>;
  currentUserId: number;
  onEventClick: (e: EventType) => void;
  onRSVP: (id: number | string, r: 'yes' | 'no') => void;
}) {
  const now = new Date();
  const originalEventId = (event as any).originalEventId || event.id;
  const eventRsvps = rsvps[originalEventId] || { yes: [], no: [] };
  const userResponse = eventRsvps.yes.includes(String(currentUserId)) ? 'yes' : eventRsvps.no.includes(String(currentUserId)) ? 'no' : null;
  const totalResponses = eventRsvps.yes.length + eventRsvps.no.length;
  const timeParts = event.time.split(' - ');
  const endTime = timeParts[1] || timeParts[0] || '00:00';
  const eventEndDateTime = parseLocalDateTime(event.date, endTime);
  const hasEventFinished = eventEndDateTime < now;
  const formatTime = (time: string) => {
    const firstPart = (time || '').split(' - ')[0] || time;
    return formatTimeForDisplay(firstPart);
  };

  return (
    <TouchableOpacity
      className="border border-white/10 rounded-xl overflow-hidden mb-3"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
      onPress={() => onEventClick(event)}
      activeOpacity={0.7}
    >
      <View className="p-4">
        <View className="flex-row items-start justify-between gap-4 mb-3">
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2 mb-1">
              <View className={`px-2 py-0.5 rounded ${getEventTypeColor(event.type) || ''}`} style={getEventTypeStyle(event.type)}>
                <Text className="text-xs font-medium text-white">{event.type.charAt(0).toUpperCase() + event.type.slice(1)}</Text>
              </View>
              {event.time && (
                <View className="flex-row items-center gap-1">
                  <Feather name="clock" size={14} color="#9ca3af" />
                  <Text className="text-sm text-gray-400" numberOfLines={1}>{formatTime(event.time)}</Text>
                </View>
              )}
            </View>
            <Text className="text-lg font-semibold text-white mb-2">{event.title}</Text>
            {event.location && (
              <View className="flex-row items-center gap-2">
                <Feather name="map-pin" size={16} color="#9ca3af" />
                <Text className="text-sm text-gray-300 flex-1" numberOfLines={1}>{event.location}</Text>
              </View>
            )}
          </View>
          <Feather name="chevron-right" size={20} color="#9ca3af" />
        </View>
        {!hasEventFinished && (
          <View className="flex-row items-center gap-2 pt-3 border-t border-white/10">
            <TouchableOpacity
              className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg ${userResponse === 'yes' ? 'bg-green-600 border-2 border-green-400' : 'bg-white/5'}`}
              onPress={(e) => { e.stopPropagation(); onRSVP(event.id, 'yes'); }}
              activeOpacity={0.7}
            >
              <Feather name="check-circle" size={16} color={userResponse === 'yes' ? '#ffffff' : '#d1d5db'} />
              <Text className={`text-sm font-medium ${userResponse === 'yes' ? 'text-white' : 'text-gray-300'}`}>
                Going {eventRsvps.yes.length > 0 && `(${eventRsvps.yes.length})`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg ${userResponse === 'no' ? 'bg-blue-600 border-2 border-blue-400' : 'bg-white/5'}`}
              onPress={(e) => { e.stopPropagation(); onRSVP(event.id, 'no'); }}
              activeOpacity={0.7}
            >
              <Feather name="x-circle" size={16} color={userResponse === 'no' ? '#ffffff' : '#d1d5db'} />
              <Text className={`text-sm font-medium ${userResponse === 'no' ? 'text-white' : 'text-gray-300'}`}>
                Not Going {eventRsvps.no.length > 0 && `(${eventRsvps.no.length})`}
              </Text>
            </TouchableOpacity>
            {totalResponses > 0 && (
              <View className="ml-auto flex-row items-center gap-1.5">
                <Feather name="users" size={16} color="#9ca3af" />
                <Text className="text-sm text-gray-400">{totalResponses}</Text>
              </View>
            )}
          </View>
        )}
        {hasEventFinished && totalResponses > 0 && (
          <View className="flex-row items-center justify-end gap-1.5 pt-3 border-t border-white/10">
            <Feather name="users" size={16} color="#9ca3af" />
            <Text className="text-sm text-gray-400">{totalResponses} responded</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ListPage({
  events,
  onEventClick,
  currentUserId,
  rsvps,
  onRSVP,
  listRef,
  onEndReached,
  onStartReached,
  onNextEventSectionVisible,
  onListReady,
  onContentSizeChange,
  onScroll,
  contentContainerStyle,
}: ListPageProps) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const webStartReachLockRef = useRef(false);
  const webEndReachLockRef = useRef(false);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 10,
    minimumViewTime: 80,
  }).current;

  const sections: CalendarSection[] = useMemo(() => {
    const sortedEvents = [...events].sort((a, b) => {
      const timeA = a.time.split(' - ')[0] || '00:00';
      const timeB = b.time.split(' - ')[0] || '00:00';
      return parseLocalDateTime(a.date, timeA).getTime()
           - parseLocalDateTime(b.date, timeB).getTime();
    });

    const grouped: Record<string, EventType[]> = {};
    sortedEvents.forEach((event) => {
      const eventDate = parseLocalDate(event.date);
      const key = eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });

    const getGroupDate = ([, evts]: [string, EventType[]]) =>
      parseLocalDate(evts[0].date).getTime();
    const pastEntries = Object.entries(grouped)
      .filter(([, evts]) => parseLocalDate(evts[0].date) < today)
      .sort((a, b) => getGroupDate(a) - getGroupDate(b));
    const futureEntries = Object.entries(grouped)
      .filter(([, evts]) => parseLocalDate(evts[0].date) >= today)
      .sort((a, b) => getGroupDate(a) - getGroupDate(b));

    const entries = futureEntries.length > 0 ? [...futureEntries, ...pastEntries] : [...pastEntries];
    return entries.map(([dateKey, data]) => ({
      title: getDateLabel(data[0].date, today),
      dateKey,
      data,
    }));
  }, [events, now.getTime(), today.getTime()]);

  useEffect(() => {
    if (sections.length === 0 || !onListReady) return;
    // Skip on web to avoid SectionList/List mount timing issues in RN web.
    if (Platform.OS === 'web') return;
    onListReady();
  }, [sections.length, onListReady]);

  const handleViewableItemsChanged = useCallback(
    (info: { viewableItems: ViewToken<EventType>[] }) => {
      if (!onNextEventSectionVisible || info.viewableItems.length === 0) return;
      const first = info.viewableItems[0];
      const section = first?.section;
      const dateKey = section?.dateKey;
      if (dateKey == null) return;
      const idx = sections.findIndex((s) => s.dateKey === dateKey);
      onNextEventSectionVisible(idx === 0);
    },
    [onNextEventSectionVisible, sections]
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (y < 200 && onStartReached) onStartReached();
      onScroll?.(e);
    },
    [onScroll, onStartReached]
  );

  const handleWebScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const y = contentOffset.y;
      if (y < 200) {
        if (!webStartReachLockRef.current) {
          webStartReachLockRef.current = true;
          onStartReached?.();
        }
      } else {
        webStartReachLockRef.current = false;
      }

      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceFromBottom < 260) {
        if (!webEndReachLockRef.current) {
          webEndReachLockRef.current = true;
          onEndReached?.();
        }
      } else {
        webEndReachLockRef.current = false;
      }

      onNextEventSectionVisible?.(y < 120);
      onScroll?.(e);
    },
    [onEndReached, onNextEventSectionVisible, onScroll, onStartReached]
  );

  if (Platform.OS === 'web') {
    return (
      <ScrollView
        onScroll={handleWebScroll}
        onContentSizeChange={onContentSizeChange}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={[{ paddingBottom: LIST_GROUP_GAP }, contentContainerStyle]}
      >
        {sections.length === 0 ? (
          <View className="items-center py-12">
            <View className="w-16 h-16 rounded-full bg-white/5 items-center justify-center mb-4">
              <Feather name="clock" size={32} color="#9ca3af" />
            </View>
            <Text className="text-xl font-semibold text-white mb-2">No events found</Text>
            <Text className="text-gray-400 text-center">You don&apos;t have any events</Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.dateKey}>
              <View className="pt-4 pb-2 flex-row items-center gap-2">
                <Text className="text-lg font-semibold text-white">{section.title}</Text>
                <Text className="text-sm text-gray-400">
                  ({section.data.length} event{section.data.length !== 1 ? 's' : ''})
                </Text>
              </View>
              {section.data.map((item) => (
                <EventCard
                  key={String(item.id)}
                  event={item}
                  rsvps={rsvps}
                  currentUserId={currentUserId}
                  onEventClick={onEventClick}
                  onRSVP={onRSVP}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <SectionList<EventType, CalendarSection>
      ref={listRef as any}
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      stickySectionHeadersEnabled={false}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={8}
      removeClippedSubviews={true}
      contentContainerStyle={[{ paddingBottom: LIST_GROUP_GAP }, contentContainerStyle]}
      ListEmptyComponent={
        <View className="items-center py-12">
          <View className="w-16 h-16 rounded-full bg-white/5 items-center justify-center mb-4">
            <Feather name="clock" size={32} color="#9ca3af" />
          </View>
          <Text className="text-xl font-semibold text-white mb-2">No events found</Text>
          <Text className="text-gray-400 text-center">You don&apos;t have any events</Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View className="pt-4 pb-2 flex-row items-center gap-2">
          <Text className="text-lg font-semibold text-white">{section.title}</Text>
          <Text className="text-sm text-gray-400">
            ({section.data.length} event{section.data.length !== 1 ? 's' : ''})
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <EventCard event={item} rsvps={rsvps} currentUserId={currentUserId} onEventClick={onEventClick} onRSVP={onRSVP} />
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      onContentSizeChange={onContentSizeChange}
      onScroll={handleScroll}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={handleViewableItemsChanged}
    />
  );
}
