import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../../utils/haptics';
import type {
  BoardCardData,
  TaskLabel,
  TaskMember,
  TaskChecklist,
  ChecklistItem,
  TaskAttachment,
} from '../../types/board';
import { TaskDatetimeField, type TaskDatetimeFieldKey } from './TaskDatetimeField';
import { TaskWorkTimeSection } from './TaskWorkTimeSection';
import { useTheme } from '../../theme';

const SHIFT = 5;
const MEMBERS_SCROLL_PADDING = 12;

const LABEL_PRESETS: TaskLabel[] = [
  { id: 'lp-1', name: 'Design', color: '#F3D9B1' },
  { id: 'lp-2', name: 'Engineering', color: '#a5d6a5' },
  { id: 'lp-3', name: 'Bug', color: '#fca5a5' },
  { id: 'lp-4', name: 'Docs', color: '#b8c5ff' },
  { id: 'lp-5', name: 'Urgent', color: '#fbbf24' },
];

const MEMBER_POOL: TaskMember[] = [
  { id: 'm-1', name: 'Alex Kim', initials: 'AK' },
  { id: 'm-2', name: 'Jordan Lee', initials: 'JL' },
  { id: 'm-3', name: 'Sam Rivera', initials: 'SR' },
  { id: 'm-4', name: 'Taylor Chen', initials: 'TC' },
];

function uid() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type Props = {
  task: BoardCardData;
  onChange: (next: BoardCardData) => void;
};

export function TaskDetailContent({ task, onChange }: Props) {
  const { colors } = useTheme();
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [labelsSectionOpen, setLabelsSectionOpen] = useState(true);
  const [activeDateField, setActiveDateField] = useState<TaskDatetimeFieldKey | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const membersSectionYRef = useRef(0);
  const checklistsSectionYRef = useRef(0);
  const attachmentsSectionYRef = useRef(0);

  const labels = task.labels ?? [];
  const assignees = task.assignees ?? [];
  const checklists = task.checklists ?? [];
  const attachments = task.attachments ?? [];
  const activity = task.activity ?? [];

  const setField = useCallback(
    <K extends keyof BoardCardData>(key: K, value: BoardCardData[K]) => {
      onChange({ ...task, [key]: value });
    },
    [task, onChange]
  );

  const toggleLabel = useCallback(
    (l: TaskLabel) => {
      hapticLight();
      const has = labels.some((x) => x.id === l.id);
      const nextLabels = has ? labels.filter((x) => x.id !== l.id) : [...labels, l];
      onChange({
        ...task,
        labels: nextLabels,
        labelColor: nextLabels[0]?.color,
      });
    },
    [task, labels, onChange]
  );

  const addMember = useCallback(
    (m: TaskMember) => {
      hapticLight();
      if (assignees.some((x) => x.id === m.id)) return;
      onChange({ ...task, assignees: [...assignees, m] });
      setMemberPickerOpen(false);
    },
    [task, assignees, onChange]
  );

  const removeMember = useCallback(
    (id: string) => {
      hapticLight();
      onChange({ ...task, assignees: assignees.filter((x) => x.id !== id) });
    },
    [task, assignees, onChange]
  );

  const addChecklist = useCallback(() => {
    hapticLight();
    const cl: TaskChecklist = {
      id: uid(),
      title: 'Checklist',
      items: [{ id: uid(), text: '', done: false }],
    };
    onChange({ ...task, checklists: [...checklists, cl] });
  }, [task, checklists, onChange]);

  const updateChecklist = useCallback(
    (id: string, next: TaskChecklist) => {
      onChange({
        ...task,
        checklists: checklists.map((c) => (c.id === id ? next : c)),
      });
    },
    [task, checklists, onChange]
  );

  const addAttachment = useCallback(() => {
    hapticLight();
    const names = ['Brief.pdf', 'Screenshot.png', 'Notes.md', 'Recording.m4a'];
    const att: TaskAttachment = {
      id: uid(),
      name: names[attachments.length % names.length],
      subtitle: 'Added just now',
    };
    onChange({ ...task, attachments: [...attachments, att] });
  }, [task, attachments, onChange]);

  const availableMembers = useMemo(
    () => MEMBER_POOL.filter((m) => !assignees.some((a) => a.id === m.id)),
    [assignees]
  );

  const toggleMemberPickerFromQuickAdd = useCallback(() => {
    setMemberPickerOpen((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({
              y: Math.max(0, membersSectionYRef.current - MEMBERS_SCROLL_PADDING),
              animated: true,
            });
          });
        });
      }
      return next;
    });
  }, []);

  const toggleMemberPickerHere = useCallback(() => {
    hapticLight();
    setMemberPickerOpen((o) => !o);
  }, []);

  const scrollToChecklists = useCallback(() => {
    hapticLight();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, checklistsSectionYRef.current - MEMBERS_SCROLL_PADDING),
          animated: true,
        });
      });
    });
  }, []);

  const scrollToAttachments = useCallback(() => {
    hapticLight();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, attachmentsSectionYRef.current - MEMBERS_SCROLL_PADDING),
          animated: true,
        });
      });
    });
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scrollInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <TextInput
          value={task.title}
          onChangeText={(t) => onChange({ ...task, title: t })}
          style={styles.titleInput}
          placeholder="Title"
          placeholderTextColor="#999"
          multiline
          scrollEnabled={false}
        />

        <Text style={styles.sectionLabel}>Quick add</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
        >
          <QuickChip icon="users" label="Assign" onPress={toggleMemberPickerFromQuickAdd} />
          <QuickChip icon="check-square" label="Checklist" onPress={scrollToChecklists} />
          <QuickChip icon="paperclip" label="Attach" onPress={scrollToAttachments} />
        </ScrollView>
        <Text style={styles.quickHint}>Dates, labels, and more — in the sections below.</Text>

        <Section title="Description" icon="align-left">
          <TextInput
            value={task.description ?? ''}
            onChangeText={(description) => setField('description', description || undefined)}
            style={styles.bodyInput}
            placeholder="Add a detailed description…"
            placeholderTextColor="#888"
            multiline
            textAlignVertical="top"
          />
        </Section>

        <Section title="Dates" icon="calendar">
          <TaskDatetimeField
            fieldKey="start"
            label="Start"
            valueIso={task.startDate}
            onChangeIso={(startDate) => setField('startDate', startDate)}
            activeField={activeDateField}
            onActiveChange={setActiveDateField}
          />
          <TaskDatetimeField
            fieldKey="due"
            label="Due"
            valueIso={task.dueDate}
            onChangeIso={(dueDate) => setField('dueDate', dueDate)}
            activeField={activeDateField}
            onActiveChange={setActiveDateField}
            showDividerTop
          />
        </Section>

        <Section title="Time tracked" icon="clock">
          <TaskWorkTimeSection
            task={task}
            onChange={onChange}
            activeField={activeDateField}
            onActiveChange={setActiveDateField}
          />
        </Section>

        <View style={styles.section}>
          <Pressable
            onPress={() => {
              hapticLight();
              setLabelsSectionOpen((o) => !o);
            }}
            style={({ pressed }) => [
              styles.labelsCollapsibleHead,
              pressed && styles.labelsCollapsibleHeadPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ expanded: labelsSectionOpen }}
            accessibilityLabel={`Labels, ${labelsSectionOpen ? 'expanded' : 'collapsed'}`}
          >
            <View style={styles.labelsCollapsibleHeadLeft}>
              <Feather name="tag" size={16} color="#666" />
              <Text style={styles.sectionTitle}>Labels</Text>
            </View>
            <View style={styles.labelsSummarySpacer} />
            <Feather
              name={labelsSectionOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#444"
              style={styles.labelsCollapsibleChevron}
            />
          </Pressable>
          {labelsSectionOpen ? (
            <View style={styles.sectionCardWrap}>
              <View style={styles.sectionCardShadow} />
              <View style={styles.sectionCard}>
                <Text style={styles.labelHint}>Tap a row to turn a label on or off.</Text>
                <View style={styles.labelList}>
                  {LABEL_PRESETS.map((l, index) => {
                    const on = labels.some((x) => x.id === l.id);
                    return (
                      <Pressable
                        key={l.id}
                        onPress={() => toggleLabel(l)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${l.name} label${on ? ', selected' : ', not selected'}`}
                        style={({ pressed }) => [
                          styles.labelRowOuter,
                          index < LABEL_PRESETS.length - 1 && styles.labelRowBorder,
                          on && styles.labelRowSelected,
                          pressed && styles.labelRowPressed,
                        ]}
                      >
                        <View style={styles.labelRow}>
                          <View style={[styles.labelSwatch, { backgroundColor: l.color }]} />
                          <Text
                            style={[styles.labelRowName, on && styles.labelRowNameOn]}
                            numberOfLines={1}
                          >
                            {l.name}
                          </Text>
                          <View style={[styles.labelRowToggle, on && styles.labelRowToggleOn]}>
                            {on ? <Feather name="check" size={18} color="#0a0a0a" /> : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <View
          onLayout={(e) => {
            membersSectionYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <Section title="Members" icon="users">
            <View style={styles.memberRowShell}>
              <View style={styles.memberRowBody}>
                {assignees.length > 0 ? (
                  <View style={styles.memberAssigneesCluster}>
                    {assignees.map((m) => (
                      <Pressable
                        key={m.id}
                        onPress={() => removeMember(m.id)}
                        accessibilityLabel={`${m.name}, assigned. Tap to remove from card.`}
                        style={({ pressed }) => [styles.memberChip, pressed && styles.memberChipPressed]}
                      >
                        <View style={[styles.memberChipAvatar, { backgroundColor: colors.canvas }]}>
                          <Text style={styles.memberChipAvatarText}>{m.initials}</Text>
                        </View>
                        <View style={styles.memberChipRemoveRow} accessibilityElementsHidden={true}>
                          <View style={styles.memberChipRemoveIcon}>
                            <Feather name="x" size={15} color="#525252" />
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.memberRowLead}>
                    {!memberPickerOpen ? (
                      <Text style={styles.memberHintInRow} numberOfLines={2}>
                        Tap + to add someone.
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
              <Pressable
                onPress={toggleMemberPickerHere}
                accessibilityLabel={memberPickerOpen ? 'Hide people you can add' : 'Show people you can add'}
                style={({ pressed }) => [
                  styles.addCircle,
                  memberPickerOpen && styles.addCircleOpen,
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Feather
                  name={memberPickerOpen ? 'chevron-up' : 'plus'}
                  size={22}
                  color={memberPickerOpen ? '#0a0a0a' : '#666'}
                />
              </Pressable>
            </View>
            {memberPickerOpen ? (
              <View style={styles.memberPickerInset}>
                <Text style={styles.memberPickerTitle}>Choose someone to add</Text>
                <Text style={styles.memberPickerSubtitle}>Tap a row — no extra button needed</Text>
                {availableMembers.length > 0 ? (
                  availableMembers.map((m, i) => (
                    <Pressable
                      key={m.id}
                      onPress={() => addMember(m)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${m.name}`}
                      style={({ pressed }) => [
                        styles.memberPickerRow,
                        i < availableMembers.length - 1 && styles.memberPickerRowBorder,
                        pressed && styles.memberPickerRowPressed,
                      ]}
                    >
                      <View style={styles.memberPickerRowInner}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{m.initials}</Text>
                        </View>
                        <Text style={styles.pickerName} numberOfLines={1}>
                          {m.name}
                        </Text>
                        <Feather name="chevron-right" size={18} color="#999" />
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.memberPickerEmpty}>
                    Everyone available is already on this card.
                  </Text>
                )}
              </View>
            ) : null}
            {memberPickerOpen ? (
              <Text style={styles.memberHint}>Tap a profile or its remove control to take someone off the card.</Text>
            ) : null}
          </Section>
        </View>

        <View
          onLayout={(e) => {
            checklistsSectionYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <Section title="Checklists" icon="check-square">
            {checklists.map((cl) => (
              <ChecklistBlock
                key={cl.id}
                checklist={cl}
                onChange={(next) => updateChecklist(cl.id, next)}
                onRemove={() =>
                  onChange({ ...task, checklists: checklists.filter((c) => c.id !== cl.id) })
                }
              />
            ))}
            <GhostButton icon="plus" label="Add checklist" onPress={addChecklist} />
          </Section>
        </View>

        <View
          onLayout={(e) => {
            attachmentsSectionYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <Section title="Attachments" icon="paperclip">
            {attachments.map((a) => (
              <View key={a.id} style={styles.attachRow}>
                <View style={[styles.attachIcon, { backgroundColor: colors.canvas }]}>
                  <Feather name="file-text" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.attachMeta}>
                  <Text style={styles.attachName}>{a.name}</Text>
                  {a.subtitle ? <Text style={styles.attachSub}>{a.subtitle}</Text> : null}
                </View>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    onChange({ ...task, attachments: attachments.filter((x) => x.id !== a.id) });
                  }}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={18} color="#b91c1c" />
                </Pressable>
              </View>
            ))}
            <GhostButton icon="plus" label="Add attachment" onPress={addAttachment} />
          </Section>
        </View>

        <Section title="Activity" icon="activity">
          {activity.length === 0 ? (
            <Text style={styles.emptyActivity}>
              No history on this card yet — moves, edits, and comments will show here.
            </Text>
          ) : (
            activity.map((entry) => (
              <View key={entry.id} style={styles.activityRow}>
                <View style={styles.activityDot} />
                <View style={styles.activityBody}>
                  <Text style={styles.activityText}>{entry.text}</Text>
                  <Text style={styles.activityAt}>{entry.at}</Text>
                </View>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function QuickChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.88 }]}
    >
      <View style={styles.quickChipIcon}>
        <Feather name={icon} size={18} color="#0a0a0a" />
      </View>
      <Text style={styles.quickChipLabel}>{label}</Text>
    </Pressable>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Feather name={icon} size={16} color="#666" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCardWrap}>
        <View style={styles.sectionCardShadow} />
        <View style={styles.sectionCard}>{children}</View>
      </View>
    </View>
  );
}

function GhostButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={({ pressed }) => [styles.ghostBtnOuter, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.ghostBtnRow}>
        <View style={styles.ghostBtnIcon}>
          <Feather name={icon} size={16} color="#0a0a0a" />
        </View>
        <Text style={styles.ghostBtnText}>{label}</Text>
      </View>
    </Pressable>
  );
}

function ChecklistBlock({
  checklist,
  onChange,
  onRemove,
}: {
  checklist: TaskChecklist;
  onChange: (next: TaskChecklist) => void;
  onRemove: () => void;
}) {
  const items = checklist.items;

  const toggleItem = (id: string) => {
    hapticLight();
    onChange({
      ...checklist,
      items: items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)),
    });
  };

  const setItemText = (id: string, text: string) => {
    onChange({
      ...checklist,
      items: items.map((it) => (it.id === id ? { ...it, text } : it)),
    });
  };

  const addItem = () => {
    hapticLight();
    onChange({
      ...checklist,
      items: [...items, { id: uid(), text: '', done: false }],
    });
  };

  return (
    <View style={styles.clBlock}>
      <View style={styles.clHead}>
        <TextInput
          value={checklist.title}
          onChangeText={(title) => onChange({ ...checklist, title })}
          style={styles.clTitleInput}
          placeholder="Checklist title"
          placeholderTextColor="#888"
        />
        <Pressable onPress={onRemove} hitSlop={8}>
          <Feather name="trash-2" size={18} color="#b91c1c" />
        </Pressable>
      </View>
      {items.map((it) => (
        <View key={it.id} style={styles.clItemRow}>
          <Pressable
            onPress={() => toggleItem(it.id)}
            style={[styles.clCheck, it.done && styles.clCheckDone]}
          >
            {it.done ? <Feather name="check" size={14} color="#fff" /> : null}
          </Pressable>
          <TextInput
            value={it.text}
            onChangeText={(t) => setItemText(it.id, t)}
            style={[styles.clItemInput, it.done && styles.clItemInputDone]}
            placeholder="Item"
            placeholderTextColor="#aaa"
          />
        </View>
      ))}
      <Pressable onPress={addItem} style={styles.clAddItem}>
        <Feather name="plus" size={16} color="#666" />
        <Text style={styles.clAddItemText}>Add item</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollInner: {
    paddingBottom: 32,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0a0a0a',
    paddingVertical: 4,
    marginBottom: 8,
    minHeight: 36,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 16,
    paddingRight: 8,
  },
  quickChip: {
    alignItems: 'center',
    width: 76,
  },
  quickChipIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0a0a0a',
    textAlign: 'center',
  },
  quickHint: {
    fontSize: 12,
    color: '#999',
    marginTop: -8,
    marginBottom: 14,
    lineHeight: 17,
  },
  memberPickerInset: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 12,
    paddingTop: 10,
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#f6f6f6',
    borderRadius: 10,
  },
  memberPickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0a0a',
    marginBottom: 2,
  },
  memberPickerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888',
    marginBottom: 8,
  },
  memberPickerRow: {
    alignSelf: 'stretch',
    borderRadius: 8,
    overflow: 'hidden',
  },
  memberPickerRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  memberPickerRowPressed: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  memberPickerRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
  },
  memberPickerEmpty: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
    paddingVertical: 10,
    lineHeight: 20,
  },
  pickerName: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '600',
    color: '#0a0a0a',
    marginLeft: 12,
    marginRight: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
    borderWidth: 1,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#333',
  },
  section: {
    marginBottom: 20,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCardWrap: {
    position: 'relative',
    marginRight: SHIFT,
    marginBottom: SHIFT,
  },
  sectionCardShadow: {
    position: 'absolute',
    left: SHIFT,
    top: SHIFT,
    right: -SHIFT,
    bottom: -SHIFT,
    backgroundColor: '#e0e0e0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
  },
  sectionCard: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
    padding: 14,
  },
  bodyInput: {
    minHeight: 100,
    fontSize: 16,
    lineHeight: 22,
    color: '#0a0a0a',
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
    lineHeight: 17,
  },
  memberHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    marginBottom: 0,
    lineHeight: 16,
  },
  memberRowLead: {
    minWidth: 0,
    minHeight: 56,
    justifyContent: 'center',
    paddingRight: 8,
  },
  memberHintInRow: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
    fontWeight: '500',
  },
  labelHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
    lineHeight: 18,
  },
  labelsCollapsibleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    minHeight: 28,
  },
  labelsCollapsibleHeadPressed: {
    opacity: 0.88,
  },
  labelsCollapsibleHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  labelsSummarySpacer: {
    flex: 1,
    minWidth: 0,
  },
  labelsCollapsibleChevron: {
    flexShrink: 0,
  },
  labelList: {
    marginTop: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  labelRowOuter: {
    width: '100%',
    alignSelf: 'stretch',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
    paddingVertical: 10,
    paddingRight: 4,
    paddingLeft: 0,
  },
  labelRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  labelRowSelected: {
    backgroundColor: '#f5f5f5',
  },
  labelRowPressed: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  labelSwatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    marginLeft: 10,
    marginRight: 12,
    flexShrink: 0,
  },
  labelRowName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
    minWidth: 0,
  },
  labelRowNameOn: {
    color: '#0a0a0a',
    fontWeight: '800',
  },
  labelRowToggle: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#c4c4c4',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  labelRowToggleOn: {
    borderColor: '#000',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  memberRowShell: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 2,
    paddingBottom: 4,
    gap: 12,
  },
  memberRowBody: {
    flex: 1,
    minWidth: 0,
  },
  memberAssigneesCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 16,
    minWidth: 0,
  },
  memberChip: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 56,
    paddingTop: 2,
    paddingBottom: 4,
  },
  memberChipPressed: {
    opacity: 0.88,
  },
  memberChipAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberChipAvatarText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  memberChipRemoveRow: {
    width: 56,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberChipRemoveIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d4d4d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircle: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    marginTop: 2,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#000',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  addCircleOpen: {
    borderStyle: 'solid',
    backgroundColor: '#eee',
  },
  clBlock: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  clHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  clTitleInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0a0a0a',
    paddingVertical: 4,
  },
  clItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  clCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clCheckDone: {
    backgroundColor: '#0a0a0a',
  },
  clItemInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0a0a0a',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  clItemInputDone: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  clAddItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  clAddItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  attachIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachMeta: {
    flex: 1,
  },
  attachName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  attachSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  ghostBtnOuter: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 8,
    paddingVertical: 8,
  },
  ghostBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  ghostBtnIcon: {
    marginRight: 8,
    flexGrow: 0,
    flexShrink: 0,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  emptyActivity: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  activityRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#a5d6a5',
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 4,
  },
  activityBody: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a0a0a',
    lineHeight: 20,
  },
  activityAt: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
});
