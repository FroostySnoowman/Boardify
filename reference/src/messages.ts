import type { Env } from './bindings'
import { jsonResponse } from './http'
import { getCurrentUserFromSession } from './auth'
import { containsProfanity } from './profanity-filter'
import { sendExpoPush } from './expo-push'

function toIso(value: any): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  if (!isNaN(d.getTime())) return d.toISOString()
  return String(value)
}

async function isTeamOwnerForGroupChat(env: Env, convId: string, uid: number): Promise<boolean> {
  const row = await env.DB
    .prepare(
      `SELECT 1 FROM group_chats gc
       INNER JOIN team_members tm ON tm.team_id = gc.team_id AND tm.user_id = ?
       WHERE gc.id = ? AND lower(tm.role) = 'owner'`
    )
    .bind(uid, convId)
    .first<any>()
  return !!row
}

async function registerDevice(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const token = data.token
  if (token) {
    await env.DB
      .prepare('INSERT INTO device_tokens (user_id, token) VALUES (?, ?) ON CONFLICT DO NOTHING')
      .bind(Number(user.id), token)
      .run()
  }

  return jsonResponse(request, {}, { status: 200 })
}

async function manageConversations(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const tid = Number(teamId)

  const chatAllowed = await env.DB
    .prepare('SELECT chat_enabled, role FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(tid, uid)
    .first<any>()

  if (!chatAllowed || !chatAllowed.chat_enabled) {
    return jsonResponse(request, { conversations: [] }, { status: 200 })
  }

  if (request.method === 'GET') {
    const isTeamOwner = String(chatAllowed.role || '').toLowerCase() === 'owner'

    const groupChatsSql = isTeamOwner
      ? `
          SELECT cr.id,
                 cr.name,
                 (SELECT content FROM messages m
                    WHERE m.conversation_id = cr.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
                 (SELECT (m.deleted_at IS NOT NULL) FROM messages m
                    WHERE m.conversation_id = cr.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message_deleted,
                 (SELECT message_type FROM messages m
                    WHERE m.conversation_id = cr.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message_type,
                 (SELECT u.username FROM messages m
                    JOIN users u ON u.id = m.sender_id
                    WHERE m.conversation_id = cr.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message_sender,
                 cr.created_at,
                 cr.updated_at,
                 (CASE WHEN gcu.user_id IS NULL THEN 0 ELSE (
                   SELECT COUNT(*) FROM messages m2
                     WHERE m2.conversation_id = cr.id
                       AND m2.sent_at > COALESCE(gcu.last_read, 0)
                       AND m2.sender_id <> ?
                 ) END) AS unread_count
            FROM group_chats cr
            INNER JOIN team_members tm ON tm.team_id = cr.team_id AND tm.user_id = ?
            LEFT JOIN group_chat_users gcu ON gcu.group_chat_id = cr.id AND gcu.user_id = ?
           WHERE cr.team_id = ?
             AND (gcu.user_id IS NOT NULL OR lower(tm.role) = 'owner')
          `
      : `
          SELECT cr.id,
                 cr.name,
                 (SELECT content FROM messages m
                    WHERE m.conversation_id = cr.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
                 (SELECT (m.deleted_at IS NOT NULL) FROM messages m
                    WHERE m.conversation_id = cr.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message_deleted,
                 (SELECT message_type FROM messages m
                    WHERE m.conversation_id = cr.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message_type,
                 (SELECT u.username FROM messages m
                    JOIN users u ON u.id = m.sender_id
                    WHERE m.conversation_id = cr.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message_sender,
                 cr.created_at,
                 cr.updated_at,
                 (SELECT COUNT(*) FROM messages m2
                   WHERE m2.conversation_id = cr.id
                     AND m2.sent_at > COALESCE(gcu.last_read, 0)
                     AND m2.sender_id <> ?
                 ) AS unread_count
            FROM group_chats cr
            JOIN group_chat_users gcu ON gcu.group_chat_id = cr.id
           WHERE cr.team_id = ?
             AND gcu.user_id = ?
          `

    const [privsRes, chatsRes, starredRes] = await Promise.all([
      env.DB
        .prepare(
          `
          SELECT pc.id,
                 (SELECT content FROM messages m
                    WHERE m.conversation_id = pc.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
                 (SELECT (m.deleted_at IS NOT NULL) FROM messages m
                    WHERE m.conversation_id = pc.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message_deleted,
                 (SELECT message_type FROM messages m
                    WHERE m.conversation_id = pc.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message_type,
                 (SELECT u.username FROM messages m
                    JOIN users u ON u.id = m.sender_id
                    WHERE m.conversation_id = pc.id
                 ORDER BY m.sent_at DESC LIMIT 1) AS last_message_sender,
                 pc.created_at,
                 pc.updated_at,
                 (SELECT COUNT(*) FROM messages m2
                   WHERE m2.conversation_id = pc.id
                     AND m2.sent_at > COALESCE(cp.last_read, 0)
                     AND m2.sender_id <> ?
                 ) AS unread_count
            FROM private_conversations pc
            JOIN conversation_participants cp ON cp.conversation_id = pc.id
           WHERE pc.team_id = ?
             AND cp.user_id = ?
          `
        )
        .bind(uid, tid, uid)
        .all<any>(),
      env.DB
        .prepare(groupChatsSql)
        .bind(
          ...(isTeamOwner ? [uid, uid, uid, tid] : [uid, tid, uid])
        )
        .all<any>(),
      env.DB
        .prepare('SELECT conversation_id FROM starred_conversations WHERE user_id = ?')
        .bind(uid)
        .all<{ conversation_id: string }>(),
    ])

    const privs = privsRes.results || []
    const chats = chatsRes.results || []
    const starredIds = new Set((starredRes.results || []).map((r) => r.conversation_id))

    const combined = [
      ...privs.map((r: any) => ({
        id: String(r.id),
        name: null,
        type: 'private' as const,
        lastMessage: r.last_message_deleted ? 'Message was deleted' : (r.last_message || ''),
        lastMessageType: r.last_message_type || 'text',
        lastMessageSender: r.last_message_sender || null,
        createdAt: toIso(r.created_at),
        updatedAt: toIso(r.updated_at),
        unreadCount: r.unread_count,
        starred: starredIds.has(String(r.id)),
      })),
      ...chats.map((r: any) => ({
        id: String(r.id),
        name: r.name,
        type: 'group' as const,
        lastMessage: r.last_message_deleted ? 'Message was deleted' : (r.last_message || ''),
        lastMessageType: r.last_message_type || 'text',
        lastMessageSender: r.last_message_sender || null,
        createdAt: toIso(r.created_at),
        updatedAt: toIso(r.updated_at),
        unreadCount: r.unread_count,
        starred: starredIds.has(String(r.id)),
      }))
    ]

    combined.sort((a, b) => {
      const aStarred = (a as any).starred ? 1 : 0
      const bStarred = (b as any).starred ? 1 : 0
      if (bStarred !== aStarred) return bStarred - aStarred
      const dateA = new Date(a.createdAt || 0).getTime()
      const dateB = new Date(b.createdAt || 0).getTime()
      return dateA - dateB
    })

    return jsonResponse(request, { conversations: combined }, { status: 200 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  let convId: string
  let updated: string

  if (data.participantId) {
    const other = Number(data.participantId)
    const conversationId = crypto.randomUUID()

    const now = new Date().toISOString()
    await env.DB.batch([
      env.DB.prepare('INSERT INTO private_conversations (id, team_id, created_at, updated_at) VALUES (?, ?, ?, ?)').bind(conversationId, tid, now, now),
      env.DB.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').bind(conversationId, uid),
      env.DB.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').bind(conversationId, other),
    ])

    convId = conversationId
    updated = new Date().toISOString()
  } else {
    const chatName = data.chatName || 'New Chat'
    const userIds = (data.userIds || []).map((id: any) => Number(id))
    const roles = data.roles || []
    const accessType = data.accessType || 'everyone'

    if (containsProfanity(chatName)) {
      return jsonResponse(request, { error: 'Chat name contains inappropriate language.' }, { status: 400 })
    }

    const groupChatId = crypto.randomUUID()
    const now = new Date().toISOString()

    await env.DB
      .prepare(
        'INSERT INTO group_chats (id, team_id, name, created_by, access_type, allowed_roles, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        groupChatId,
        tid,
        chatName,
        uid,
        accessType,
        roles.length > 0 ? JSON.stringify(roles) : null,
        now,
        now
      )
      .run()

    const insertStmts: D1PreparedStatement[] = []
    const insertPrep = env.DB.prepare(
      'INSERT INTO group_chat_users (group_chat_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING'
    )
    if (accessType === 'everyone') {
      const teamMembers = await env.DB
        .prepare('SELECT user_id FROM team_members WHERE team_id = ?')
        .bind(tid)
        .all<any>()
      for (const member of teamMembers.results || []) {
        insertStmts.push(insertPrep.bind(groupChatId, member.user_id))
      }
    } else if (accessType === 'roles') {
      if (roles.length > 0) {
        const placeholders = roles.map(() => '?').join(',')
        const query = `SELECT user_id FROM team_members WHERE team_id = ? AND role IN (${placeholders})`
        const stmt = env.DB.prepare(query)
        const roleMembers = await stmt.bind(tid, ...roles).all<any>()
        for (const member of roleMembers.results || []) {
          insertStmts.push(insertPrep.bind(groupChatId, member.user_id))
        }
      }
    } else if (accessType === 'users') {
      for (const userId of userIds) {
        insertStmts.push(insertPrep.bind(groupChatId, userId))
      }
    } else if (accessType === 'roles_and_users') {
      if (roles.length > 0) {
        const placeholders = roles.map(() => '?').join(',')
        const query = `SELECT user_id FROM team_members WHERE team_id = ? AND role IN (${placeholders})`
        const stmt = env.DB.prepare(query)
        const roleMembers = await stmt.bind(tid, ...roles).all<any>()
        for (const member of roleMembers.results || []) {
          insertStmts.push(insertPrep.bind(groupChatId, member.user_id))
        }
      }
      for (const userId of userIds) {
        insertStmts.push(insertPrep.bind(groupChatId, userId))
      }
    }
    if (insertStmts.length > 0) {
      await env.DB.batch(insertStmts)
    }

    convId = groupChatId
    updated = now
  }

  const summary = { conversationId: convId, lastMessage: '', updatedAt: updated }

  await broadcastToTeam(env, teamId, summary, uid)

  return jsonResponse(request, { id: convId }, { status: 201 })
}

async function manageMessages(request: Request, env: Env, convId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)

  const [isPriv, isChatMember, chatInfo, teamIdRow] = await Promise.all([
    env.DB.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
      .bind(convId, uid)
      .first<any>(),
    env.DB.prepare('SELECT 1 FROM group_chat_users WHERE group_chat_id = ? AND user_id = ?')
      .bind(convId, uid)
      .first<any>(),
    env.DB.prepare(
      `SELECT gc.access_type, gc.allowed_roles, gc.team_id, tm.role, tm.chat_enabled
       FROM group_chats gc
       JOIN team_members tm ON tm.team_id = gc.team_id
       WHERE gc.id = ? AND tm.user_id = ?`
    )
      .bind(convId, uid)
      .first<any>(),
    env.DB.prepare(
      `SELECT team_id FROM private_conversations WHERE id = ?
       UNION
       SELECT team_id FROM group_chats WHERE id = ?`
    )
      .bind(convId, convId)
      .first<any>(),
  ])

  if (!isPriv && !isChatMember) {
    const ownerOk = await isTeamOwnerForGroupChat(env, convId, uid)
    if (!ownerOk) {
      return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
    }
  }

  if (!isPriv && chatInfo) {
    const userRole = chatInfo.role
    const isPrivileged =
      userRole != null &&
      (userRole.toLowerCase() === 'owner' || userRole.toLowerCase() === 'coach')

    if (!isPrivileged) {
      if (chatInfo.access_type === 'roles' || chatInfo.access_type === 'roles_and_users') {
        if (chatInfo.allowed_roles) {
          try {
            const allowedRoles = JSON.parse(chatInfo.allowed_roles)
            if (Array.isArray(allowedRoles) && !allowedRoles.includes(userRole)) {
              return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
            }
          } catch (e) {
            // ignore invalid JSON, fallback to group_chat_users membership
          }
        }
      }
    }
  }

  let teamId: number | null = teamIdRow?.team_id ?? chatInfo?.team_id ?? null

  if (chatInfo && !chatInfo.chat_enabled) {
    return jsonResponse(request, { error: 'Chat is disabled by an adult.' }, { status: 403 })
  }

  if (request.method === 'GET') {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const before = url.searchParams.get('before')
    const queryLimit = limit + 1

    let query = `
      SELECT
          m.id, m.sender_id, m.content, m.parent_message_id, m.reply_to_message_id, m.attachments,
          m.sent_at, m.message_type, m.edited_at, m.deleted_at, m.metadata,
          u.username,
          u.profile_picture_url,
          reply_to.content as reply_to_message_content,
          reply_to_sender.username as reply_to_message_sender_name,
          reply_to_sender.profile_picture_url as reply_to_message_sender_profile_picture,
          (SELECT COUNT(*) FROM message_read_receipts WHERE message_id = m.id) as read_count,
          (SELECT COUNT(*) FROM messages reps WHERE reps.parent_message_id = m.id) as reply_count
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN messages reply_to ON reply_to.id = m.reply_to_message_id
      LEFT JOIN users reply_to_sender ON reply_to_sender.id = reply_to.sender_id
      WHERE m.conversation_id = ?
    `

    const params: any[] = [convId]
    if (before) {
      query += ' AND m.sent_at < ?'
      params.push(parseInt(before))
    }

    query += ' ORDER BY m.sent_at DESC LIMIT ?'
    params.push(queryLimit)

    const res = await env.DB.prepare(query).bind(...params).all<any>()
    const rows = res.results || []
    const hasMore = rows.length > limit
    const actualRows = hasMore ? rows.slice(0, limit) : rows
    const reversed = actualRows.reverse()

    const msgIds = reversed.map((r: any) => String(r.id))
    let reactionsMap: Record<string, { emoji: string; count: number; userIds: number[] }[]> = {}
    if (msgIds.length > 0) {
      const placeholders = msgIds.map(() => '?').join(',')
      const reactionsRes = await env.DB
        .prepare(`SELECT message_id, emoji, user_id FROM message_reactions WHERE message_id IN (${placeholders})`)
        .bind(...msgIds)
        .all<any>()
      const reactionRows = reactionsRes.results || []
      const grouped: Record<string, Record<string, number[]>> = {}
      for (const rr of reactionRows) {
        if (!grouped[rr.message_id]) grouped[rr.message_id] = {}
        if (!grouped[rr.message_id][rr.emoji]) grouped[rr.message_id][rr.emoji] = []
        grouped[rr.message_id][rr.emoji].push(rr.user_id)
      }
      for (const [mid, emojis] of Object.entries(grouped)) {
        reactionsMap[mid] = Object.entries(emojis).map(([emoji, userIds]) => ({
          emoji,
          count: userIds.length,
          userIds
        }))
      }
    }

    const msgs = reversed.map((r: any) => {
      const sentTime = new Date(r.sent_at * 1000).toISOString()
      let attachments: string[] = []
      try {
        attachments = JSON.parse(r.attachments || '[]')
      } catch (e) {
        attachments = []
      }
      let metadata: any = {}
      try {
        metadata = JSON.parse(r.metadata || '{}')
      } catch (e) {
        metadata = {}
      }

      if (r.deleted_at) {
        const userRole = chatInfo?.role
        const canViewDeleted =
          userRole != null &&
          (userRole.toLowerCase() === 'owner' || userRole.toLowerCase() === 'coach')
        return {
          id: String(r.id),
          senderId: String(r.sender_id),
          senderName: r.username || 'Unknown',
          senderProfilePicture: r.profile_picture_url || null,
          content: '',
          timestamp: sentTime,
          isMine: r.sender_id === uid,
          sentAt: r.sent_at,
          parentMessageId: r.parent_message_id ? String(r.parent_message_id) : null,
          replyToMessageId: null,
          replyToMessageContent: null,
          replyToMessageSenderName: null,
          readCount: 0,
          replyCount: r.reply_count,
          attachments: [],
          messageType: r.message_type || 'text',
          editedAt: null,
          deleted: true,
          metadata: {},
          reactions: [],
          ...(canViewDeleted && r.content ? { deletedContent: r.content } : {})
        }
      }

      return {
        id: String(r.id),
        senderId: String(r.sender_id),
        senderName: r.username || 'Unknown',
        senderProfilePicture: r.profile_picture_url || null,
        content: r.content,
        timestamp: sentTime,
        isMine: r.sender_id === uid,
        sentAt: r.sent_at,
        parentMessageId: r.parent_message_id ? String(r.parent_message_id) : null,
        replyToMessageId: r.reply_to_message_id ? String(r.reply_to_message_id) : null,
        replyToMessageContent: r.reply_to_message_content,
        replyToMessageSenderName: r.reply_to_message_sender_name,
        replyToMessageSenderProfilePicture: r.reply_to_message_sender_profile_picture || null,
        readCount: r.read_count,
        replyCount: r.reply_count,
        attachments,
        messageType: r.message_type || 'text',
        editedAt: r.edited_at || null,
        deleted: false,
        metadata,
        reactions: reactionsMap[String(r.id)] || []
      }
    })

    return jsonResponse(request, { messages: msgs, hasMore }, { status: 200 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const content: string | undefined = data.content
  const parentMessageId: string | null = data.parentMessageId || null
  const replyToMessageId: string | null = data.replyToMessageId || null
  const attachments: string[] = Array.isArray(data.attachments) ? data.attachments : []
  const messageType: string = data.messageType || 'text'
  const metadata: any = data.metadata || {}

  const validTypes = ['text', 'poll', 'announcement', 'voice', 'gif']
  if (!validTypes.includes(messageType)) {
    return jsonResponse(request, { error: 'Invalid message type' }, { status: 400 })
  }

  if (messageType === 'announcement') {
    if (teamId) {
      const memberRow = await env.DB
        .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
        .bind(teamId, uid)
        .first<any>()
      if (!memberRow || (memberRow.role !== 'Owner' && memberRow.role !== 'Coach')) {
        return jsonResponse(request, { error: 'Only coaches and owners can send announcements' }, { status: 403 })
      }
    }
  }

  const needsContent = messageType === 'text' || messageType === 'announcement'
  if (needsContent && !content && attachments.length === 0) {
    return jsonResponse(request, { error: 'Content or attachments required' }, { status: 400 })
  }
  const MAX_VOICE_DURATION_MS = 10 * 60 * 1000
  if (messageType === 'voice' && !metadata.voiceUrl) {
    return jsonResponse(request, { error: 'voiceUrl required for voice messages' }, { status: 400 })
  }
  if (messageType === 'voice' && metadata.durationMs != null && Number(metadata.durationMs) > MAX_VOICE_DURATION_MS) {
    return jsonResponse(request, { error: 'Voice message too long (max 10 minutes)' }, { status: 400 })
  }
  if (messageType === 'gif' && !metadata.gifUrl) {
    return jsonResponse(request, { error: 'gifUrl required for gif messages' }, { status: 400 })
  }

  if (content && containsProfanity(content)) {
    return jsonResponse(request, { error: 'Message contains inappropriate language.' }, { status: 400 })
  }

  if (attachments.length > 5) {
    return jsonResponse(request, { error: 'Maximum 5 attachments allowed' }, { status: 400 })
  }

  const mentionedUserIds: number[] = []
  let mentionUsernames: string[] = []
  if (content && teamId) {
    const mentionPattern = /@([^\s@]+)/g
    let match
    while ((match = mentionPattern.exec(content)) !== null) {
      mentionUsernames.push(match[1])
    }
  }

  let replyToMessageContent: string | null = null
  let replyToMessageSenderName: string | null = null
  let replyToMessageSenderProfilePicture: string | null = null

  const parallelQueries: Promise<any>[] = []
  const hasMentions = mentionUsernames.length > 0
  if (hasMentions) {
    const placeholders = mentionUsernames.map(() => '?').join(',')
    parallelQueries.push(
      env.DB.prepare(
        `SELECT u.id FROM users u
         JOIN team_members tm ON tm.user_id = u.id
         WHERE tm.team_id = ? AND u.username IN (${placeholders})`
      ).bind(teamId, ...mentionUsernames).all<any>()
    )
  }
  if (replyToMessageId) {
    parallelQueries.push(
      env.DB.prepare(
        `SELECT m.content, u.username, u.profile_picture_url
         FROM messages m
         LEFT JOIN users u ON u.id = m.sender_id
         WHERE m.id = ?`
      ).bind(replyToMessageId).first<any>()
    )
  }

  if (parallelQueries.length > 0) {
    const results = await Promise.all(parallelQueries)
    let idx = 0
    if (hasMentions) {
      const mentionRows = results[idx++]
      for (const row of mentionRows.results || []) {
        if (row.id !== uid) mentionedUserIds.push(row.id)
      }
      if (mentionedUserIds.length > 0) {
        metadata.mentions = mentionedUserIds
      }
    }
    if (replyToMessageId) {
      const replyRow = results[idx++]
      if (replyRow) {
        replyToMessageContent = replyRow.content || null
        replyToMessageSenderName = replyRow.username || 'Unknown'
        replyToMessageSenderProfilePicture = replyRow.profile_picture_url || null
      }
    }
  }

  const messageId = crypto.randomUUID()
  const sentAt = Math.floor(Date.now() / 1000)

  await env.DB
    .prepare(
      'INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, parent_message_id, reply_to_message_id, attachments, message_type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      messageId,
      convId,
      uid,
      content || '',
      sentAt,
      parentMessageId,
      replyToMessageId,
      JSON.stringify(attachments),
      messageType,
      JSON.stringify(metadata)
    )
    .run()

  const updatedAt = new Date().toISOString()
  const parentTable = isPriv ? 'private_conversations' : 'group_chats'
  await env.DB
    .prepare(`UPDATE ${parentTable} SET updated_at = ? WHERE id = ?`)
    .bind(updatedAt, convId)
    .run()

  const ts = new Date(sentAt * 1000).toISOString()

  const msgEvent = {
    conversationId: convId,
    id: messageId,
    senderId: uid,
    senderName: (user as any).username || (user as any).email || 'Unknown',
    senderProfilePicture:
      (user as any).profilePictureUrl || (user as any).profile_picture_url || null,
    content: content || '',
    timestamp: ts,
    isMine: false,
    sentAt,
    parentMessageId,
    replyToMessageId,
    replyToMessageContent,
    replyToMessageSenderName,
    replyToMessageSenderProfilePicture,
    attachments,
    messageType,
    metadata,
    reactions: []
  }

  await broadcastToConversation(env, convId, msgEvent, uid)

  if (teamId) {
    let recipientIds: number[] = []

    if (messageType === 'announcement') {
      const rows = await env.DB
        .prepare('SELECT user_id FROM team_members WHERE team_id = ? AND user_id <> ?')
        .bind(teamId, uid)
        .all<any>()
      recipientIds = (rows.results || []).map((r: any) => r.user_id)
    } else if (isPriv) {
      const rows = await env.DB
        .prepare(
          `SELECT cp.user_id FROM conversation_participants cp
           INNER JOIN team_members tm ON tm.user_id = cp.user_id AND tm.team_id = ?
           WHERE cp.conversation_id = ? AND cp.user_id <> ?`
        )
        .bind(teamId, convId, uid)
        .all<any>()
      recipientIds = (rows.results || []).map((r: any) => r.user_id)
    } else {
      const rows = await env.DB
        .prepare(
          `SELECT gcu.user_id FROM group_chat_users gcu
           INNER JOIN team_members tm ON tm.user_id = gcu.user_id AND tm.team_id = ?
           WHERE gcu.group_chat_id = ? AND gcu.user_id <> ?`
        )
        .bind(teamId, convId, uid)
        .all<any>()
      recipientIds = (rows.results || []).map((r: any) => r.user_id)
    }

    if (recipientIds.length > 0) {
      const tokenRows = await env.DB
        .prepare(
          'SELECT user_id, token FROM device_tokens WHERE user_id IN (' +
          recipientIds.map(() => '?').join(',') +
          ')'
        )
        .bind(...recipientIds)
        .all<any>()

      const pushTokens = (tokenRows.results || []).map((r: any) => ({ userId: r.user_id, token: r.token }))

      if (pushTokens.length > 0) {
        const [userRow, teamRow] = await Promise.all([
          env.DB.prepare('SELECT username FROM users WHERE id = ?')
            .bind(uid)
            .first<any>(),
          env.DB.prepare('SELECT name FROM teams WHERE id = ?')
            .bind(teamId)
            .first<any>()
        ])
        const senderName = userRow?.username || 'Someone'
        const teamName = teamRow?.name || ''

        const prefix = messageType === 'announcement' ? '[ANNOUNCEMENT] ' : ''
        const title = `${prefix}${senderName} (${teamName})`

        let pushBody = content || ''
        if (messageType === 'voice') pushBody = 'Voice message'
        if (messageType === 'gif') pushBody = 'sent a GIF'
        if (messageType === 'poll') pushBody = 'created a poll'

        await Promise.all(pushTokens.map(({ userId: tokenUserId, token }) => {
          const isMentioned = mentionedUserIds.includes(tokenUserId)
          return sendExpoPush(
            env,
            token,
            isMentioned ? `${senderName} mentioned you (${teamName})` : title,
            pushBody,
            {
              type: 'chat',
              convId,
              teamId: String(teamId),
              ...(isMentioned ? { mention: true } : {}),
            },
            'chat-messages',
            '[Chat]',
          ).catch(() => {})
        }))
      }
    }

    const summary = { conversationId: convId, lastMessage: content || '', updatedAt: ts }
    await broadcastToTeam(env, String(teamId), summary, uid)
  }

  return jsonResponse(request, { id: messageId, sentAt: ts, messageType }, { status: 201 })
}

async function markAsRead(request: Request, env: Env, convId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)

  const messageIds = await env.DB
    .prepare('SELECT id, sent_at FROM messages WHERE conversation_id = ? ORDER BY sent_at DESC')
    .bind(convId)
    .all<any>()

  const results = messageIds.results || []
  if (results.length > 0) {
    const readAt = new Date().toISOString()
    const latestSentAt = results[0].sent_at

    const stmts: D1PreparedStatement[] = results.map((row: any) =>
      env.DB.prepare('INSERT INTO message_read_receipts (message_id, user_id, read_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
        .bind(row.id, uid, readAt)
    )

    stmts.push(
      env.DB.prepare(
        'UPDATE conversation_participants SET last_read = ? WHERE conversation_id = ? AND user_id = ?'
      ).bind(latestSentAt, convId, uid)
    )
    stmts.push(
      env.DB.prepare(
        'UPDATE group_chat_users SET last_read = ? WHERE group_chat_id = ? AND user_id = ?'
      ).bind(latestSentAt, convId, uid)
    )

    await env.DB.batch(stmts)

    await broadcastToConversation(env, convId, {
      type: 'read_receipt',
      userId: uid,
      username: (user as any).username || 'Unknown',
      messageIds: results.map((r: any) => String(r.id)),
    }, uid)
  }

  return jsonResponse(request, { status: 'ok' }, { status: 200 })
}

async function getReadBy(request: Request, env: Env, messageId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const rows = await env.DB
    .prepare(
      `
      SELECT u.id, u.username
      FROM message_read_receipts r
      JOIN users u ON r.user_id = u.id
      WHERE r.message_id = ?
      `
    )
    .bind(messageId)
    .all<any>()

  const result = (rows.results || []).map((r: any) => ({
    id: String(r.id),
    username: r.username
  }))

  return jsonResponse(request, result, { status: 200 })
}

async function handleReaction(request: Request, env: Env, convId: string, msgId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  if (request.method === 'POST') {
    let data: any = {}
    try { data = await request.json() } catch { data = {} }
    const emoji = data.emoji
    if (!emoji || typeof emoji !== 'string') {
      return jsonResponse(request, { error: 'emoji required' }, { status: 400 })
    }

    await env.DB
      .prepare('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
      .bind(msgId, uid, emoji)
      .run()

    await broadcastToConversation(env, convId, {
      type: 'reaction',
      messageId: msgId,
      emoji,
      userId: uid,
      username: (user as any).username || 'Unknown',
      action: 'add'
    }, uid)

    return jsonResponse(request, { status: 'ok' }, { status: 200 })
  }

  return jsonResponse(request, { error: 'Method not allowed' }, { status: 405 })
}

async function handleRemoveReaction(request: Request, env: Env, convId: string, msgId: string, emoji: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  await env.DB
    .prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
    .bind(msgId, uid, emoji)
    .run()

  await broadcastToConversation(env, convId, {
    type: 'reaction',
    messageId: msgId,
    emoji,
    userId: uid,
    username: (user as any).username || 'Unknown',
    action: 'remove'
  }, uid)

  return jsonResponse(request, { status: 'ok' }, { status: 200 })
}

async function editMessage(request: Request, env: Env, convId: string, msgId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  const msg = await env.DB
    .prepare('SELECT sender_id, deleted_at FROM messages WHERE id = ? AND conversation_id = ?')
    .bind(msgId, convId)
    .first<any>()

  if (!msg) return jsonResponse(request, { error: 'Message not found' }, { status: 404 })
  if (msg.deleted_at) return jsonResponse(request, { error: 'Cannot edit a deleted message' }, { status: 400 })
  if (msg.sender_id !== uid) return jsonResponse(request, { error: 'Can only edit your own messages' }, { status: 403 })

  let data: any = {}
  try { data = await request.json() } catch { data = {} }
  const content = data.content
  if (!content || typeof content !== 'string' || !content.trim()) {
    return jsonResponse(request, { error: 'Content required' }, { status: 400 })
  }
  if (containsProfanity(content)) {
    return jsonResponse(request, { error: 'Message contains inappropriate language.' }, { status: 400 })
  }

  const editedAt = Math.floor(Date.now() / 1000)
  await env.DB
    .prepare('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?')
    .bind(content.trim(), editedAt, msgId)
    .run()

  await broadcastToConversation(env, convId, {
    type: 'message_edited',
    messageId: msgId,
    content: content.trim(),
    editedAt
  }, uid)

  return jsonResponse(request, { status: 'ok', editedAt }, { status: 200 })
}

async function deleteMessage(request: Request, env: Env, convId: string, msgId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  const msg = await env.DB
    .prepare('SELECT sender_id FROM messages WHERE id = ? AND conversation_id = ?')
    .bind(msgId, convId)
    .first<any>()

  if (!msg) return jsonResponse(request, { error: 'Message not found' }, { status: 404 })

  if (msg.sender_id !== uid) {
    const authRow = await env.DB
      .prepare(
        `SELECT c.team_id, tm.role FROM (
           SELECT id, team_id FROM group_chats WHERE id = ?
           UNION SELECT id, team_id FROM private_conversations WHERE id = ?
         ) c
         LEFT JOIN team_members tm ON tm.team_id = c.team_id AND tm.user_id = ?`
      )
      .bind(convId, convId, uid)
      .first<any>()

    if (!authRow?.team_id || !authRow.role || (authRow.role !== 'Owner' && authRow.role !== 'Coach')) {
      return jsonResponse(request, { error: 'Not authorized to delete this message' }, { status: 403 })
    }
  }

  const deletedAt = Math.floor(Date.now() / 1000)
  await env.DB
    .prepare('UPDATE messages SET deleted_at = ? WHERE id = ?')
    .bind(deletedAt, msgId)
    .run()

  await broadcastToConversation(env, convId, {
    type: 'message_deleted',
    messageId: msgId
  }, uid)

  return jsonResponse(request, { status: 'ok' }, { status: 200 })
}

async function createPoll(request: Request, env: Env, convId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  let data: any = {}
  try { data = await request.json() } catch { data = {} }

  const question = data.question
  const options: string[] = data.options || []
  const allowMultiple = data.allowMultiple ? 1 : 0
  const anonymous = data.anonymous ? 1 : 0
  const closesAt = data.closesAt || null

  if (!question || typeof question !== 'string' || !question.trim()) {
    return jsonResponse(request, { error: 'Question required' }, { status: 400 })
  }
  if (!Array.isArray(options) || options.length < 2) {
    return jsonResponse(request, { error: 'At least 2 options required' }, { status: 400 })
  }
  if (options.length > 10) {
    return jsonResponse(request, { error: 'Maximum 10 options allowed' }, { status: 400 })
  }
  if (containsProfanity(question)) {
    return jsonResponse(request, { error: 'Poll question contains inappropriate language.' }, { status: 400 })
  }

  const messageId = crypto.randomUUID()
  const pollId = crypto.randomUUID()
  const sentAt = Math.floor(Date.now() / 1000)

  await env.DB
    .prepare(
      'INSERT INTO messages (id, conversation_id, sender_id, content, sent_at, message_type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(messageId, convId, uid, question.trim(), sentAt, 'poll', JSON.stringify({ pollId }))
    .run()

  await env.DB
    .prepare(
      'INSERT INTO polls (id, conversation_id, message_id, question, created_by, allow_multiple, anonymous, closes_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(pollId, convId, messageId, question.trim(), uid, allowMultiple, anonymous, closesAt)
    .run()

  const pollOptions: { id: string; label: string; position: number }[] = []
  const optionStmts: D1PreparedStatement[] = []
  for (let i = 0; i < options.length; i++) {
    const optionId = crypto.randomUUID()
    optionStmts.push(
      env.DB.prepare('INSERT INTO poll_options (id, poll_id, label, position) VALUES (?, ?, ?, ?)')
        .bind(optionId, pollId, options[i].trim(), i)
    )
    pollOptions.push({ id: optionId, label: options[i].trim(), position: i })
  }
  if (optionStmts.length > 0) await env.DB.batch(optionStmts)

  const convMeta = await env.DB
    .prepare(
      `SELECT team_id, parent_table FROM (
         SELECT team_id, 'private_conversations' AS parent_table FROM private_conversations WHERE id = ?
         UNION ALL
         SELECT team_id, 'group_chats' AS parent_table FROM group_chats WHERE id = ?
       )`
    )
    .bind(convId, convId)
    .first<{ team_id: number; parent_table: string }>()

  const updatedAt = new Date().toISOString()
  const parentTableName = convMeta?.parent_table ?? 'group_chats'
  await env.DB
    .prepare(`UPDATE ${parentTableName} SET updated_at = ? WHERE id = ?`)
    .bind(updatedAt, convId)
    .run()

  const ts = new Date(sentAt * 1000).toISOString()

  const msgEvent = {
    conversationId: convId,
    id: messageId,
    senderId: uid,
    senderName: (user as any).username || (user as any).email || 'Unknown',
    senderProfilePicture: (user as any).profilePictureUrl || (user as any).profile_picture_url || null,
    content: question.trim(),
    timestamp: ts,
    isMine: false,
    sentAt,
    parentMessageId: null,
    replyToMessageId: null,
    attachments: [],
    messageType: 'poll',
    metadata: {
      pollId,
      poll: {
        id: pollId,
        question: question.trim(),
        options: pollOptions.map(o => ({ ...o, voteCount: 0, voters: [] })),
        allowMultiple: !!allowMultiple,
        anonymous: !!anonymous,
        closesAt,
        totalVotes: 0,
        myVotes: []
      }
    },
    reactions: []
  }

  await broadcastToConversation(env, convId, msgEvent, uid)

  if (convMeta?.team_id) {
    const summary = { conversationId: convId, lastMessage: `Poll: ${question.trim()}`, updatedAt: ts }
    await broadcastToTeam(env, String(convMeta.team_id), summary, uid)
  }

  return jsonResponse(request, { id: messageId, pollId, sentAt: ts }, { status: 201 })
}

async function getPoll(request: Request, env: Env, pollId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  const [poll, optionsRes] = await Promise.all([
    env.DB.prepare('SELECT * FROM polls WHERE id = ?').bind(pollId).first<any>(),
    env.DB.prepare('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY position').bind(pollId).all<any>(),
  ])

  if (!poll) return jsonResponse(request, { error: 'Poll not found' }, { status: 404 })

  const options = optionsRes.results || []
  const votesByOption: Record<string, any[]> = {}
  for (const opt of options) {
    votesByOption[opt.id] = []
  }

  if (options.length > 0) {
    const optionIds = options.map((o: any) => o.id)
    const placeholders = optionIds.map(() => '?').join(', ')
    const votesRes = await env.DB
      .prepare(`SELECT pv.option_id, pv.user_id, u.username, u.profile_picture_url FROM poll_votes pv JOIN users u ON u.id = pv.user_id WHERE pv.option_id IN (${placeholders})`)
      .bind(...optionIds)
      .all<any>()

    for (const v of votesRes.results || []) {
      votesByOption[v.option_id].push(v)
    }
  }

  let totalVotes = 0
  const myVotes: string[] = []
  const optionsWithVotes = options.map((opt: any) => {
    const voters = votesByOption[opt.id] || []
    totalVotes += voters.length

    const userVoted = voters.some((v: any) => v.user_id === uid)
    if (userVoted) myVotes.push(opt.id)

    return {
      id: opt.id,
      label: opt.label,
      position: opt.position,
      voteCount: voters.length,
      voters: poll.anonymous ? [] : voters.map((v: any) => ({
        id: String(v.user_id),
        username: v.username,
        profilePictureUrl: v.profile_picture_url
      }))
    }
  })

  return jsonResponse(request, {
    id: poll.id,
    question: poll.question,
    conversationId: poll.conversation_id,
    messageId: poll.message_id,
    createdBy: poll.created_by,
    allowMultiple: !!poll.allow_multiple,
    anonymous: !!poll.anonymous,
    closesAt: poll.closes_at,
    createdAt: poll.created_at,
    options: optionsWithVotes,
    totalVotes,
    myVotes
  }, { status: 200 })
}

async function votePoll(request: Request, env: Env, pollId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  const poll = await env.DB
    .prepare('SELECT * FROM polls WHERE id = ?')
    .bind(pollId)
    .first<any>()
  if (!poll) return jsonResponse(request, { error: 'Poll not found' }, { status: 404 })

  if (poll.closes_at && Math.floor(Date.now() / 1000) > poll.closes_at) {
    return jsonResponse(request, { error: 'Poll is closed' }, { status: 400 })
  }

  let data: any = {}
  try { data = await request.json() } catch { data = {} }
  const optionId = data.optionId
  if (!optionId) return jsonResponse(request, { error: 'optionId required' }, { status: 400 })

  const option = await env.DB
    .prepare('SELECT id FROM poll_options WHERE id = ? AND poll_id = ?')
    .bind(optionId, pollId)
    .first<any>()
  if (!option) return jsonResponse(request, { error: 'Invalid option' }, { status: 400 })

  if (!poll.allow_multiple) {
    await env.DB
      .prepare('DELETE FROM poll_votes WHERE user_id = ? AND option_id IN (SELECT id FROM poll_options WHERE poll_id = ?)')
      .bind(uid, pollId)
      .run()
  }

  await env.DB
    .prepare('INSERT INTO poll_votes (option_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
    .bind(optionId, uid)
    .run()

  await broadcastToConversation(env, poll.conversation_id, {
    type: 'poll_vote',
    pollId,
    optionId,
    userId: uid,
    username: (user as any).username || 'Unknown',
    action: 'add'
  }, uid)

  return jsonResponse(request, { status: 'ok' }, { status: 200 })
}

async function removePollVote(request: Request, env: Env, pollId: string, optionId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  const poll = await env.DB
    .prepare('SELECT * FROM polls WHERE id = ?')
    .bind(pollId)
    .first<any>()
  if (!poll) return jsonResponse(request, { error: 'Poll not found' }, { status: 404 })

  await env.DB
    .prepare('DELETE FROM poll_votes WHERE option_id = ? AND user_id = ?')
    .bind(optionId, uid)
    .run()

  await broadcastToConversation(env, poll.conversation_id, {
    type: 'poll_vote',
    pollId,
    optionId,
    userId: uid,
    username: (user as any).username || 'Unknown',
    action: 'remove'
  }, uid)

  return jsonResponse(request, { status: 'ok' }, { status: 200 })
}

async function pinMessage(request: Request, env: Env, convId: string, msgId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  const [teamIdRow, msg] = await Promise.all([
    env.DB.prepare('SELECT team_id FROM group_chats WHERE id = ? UNION SELECT team_id FROM private_conversations WHERE id = ?')
      .bind(convId, convId).first<any>(),
    env.DB.prepare('SELECT id FROM messages WHERE id = ? AND conversation_id = ?')
      .bind(msgId, convId).first<any>(),
  ])

  if (teamIdRow) {
    const memberRow = await env.DB
      .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamIdRow.team_id, uid)
      .first<any>()
    if (!memberRow || (memberRow.role !== 'Owner' && memberRow.role !== 'Coach')) {
      return jsonResponse(request, { error: 'Only coaches and owners can pin messages' }, { status: 403 })
    }
  }

  if (!msg) return jsonResponse(request, { error: 'Message not found' }, { status: 404 })

  await env.DB
    .prepare('INSERT INTO pinned_messages (conversation_id, message_id, pinned_by) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(convId, msgId, uid)
    .run()

  await broadcastToConversation(env, convId, {
    type: 'message_pinned',
    messageId: msgId,
    pinnedBy: uid,
    pinnedByName: (user as any).username || 'Unknown'
  }, uid)

  return jsonResponse(request, { status: 'ok' }, { status: 200 })
}

async function unpinMessage(request: Request, env: Env, convId: string, msgId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  const teamIdRow = await env.DB
    .prepare('SELECT team_id FROM group_chats WHERE id = ? UNION SELECT team_id FROM private_conversations WHERE id = ?')
    .bind(convId, convId)
    .first<any>()

  if (teamIdRow) {
    const memberRow = await env.DB
      .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamIdRow.team_id, uid)
      .first<any>()
    if (!memberRow || (memberRow.role !== 'Owner' && memberRow.role !== 'Coach')) {
      return jsonResponse(request, { error: 'Only coaches and owners can unpin messages' }, { status: 403 })
    }
  }

  await env.DB
    .prepare('DELETE FROM pinned_messages WHERE conversation_id = ? AND message_id = ?')
    .bind(convId, msgId)
    .run()

  await broadcastToConversation(env, convId, {
    type: 'message_unpinned',
    messageId: msgId
  }, uid)

  return jsonResponse(request, { status: 'ok' }, { status: 200 })
}

async function getPinnedMessages(request: Request, env: Env, convId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  const rows = await env.DB
    .prepare(
      `SELECT m.id, m.sender_id, m.content, m.sent_at, m.message_type, m.metadata, m.attachments,
              u.username, u.profile_picture_url,
              pm.pinned_by, pm.pinned_at,
              pinner.username as pinned_by_name
       FROM pinned_messages pm
       JOIN messages m ON m.id = pm.message_id
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN users pinner ON pinner.id = pm.pinned_by
       WHERE pm.conversation_id = ?
       ORDER BY pm.pinned_at DESC`
    )
    .bind(convId)
    .all<any>()

  const pinned = (rows.results || []).map((r: any) => {
    let attachments: string[] = []
    try { attachments = JSON.parse(r.attachments || '[]') } catch { attachments = [] }
    let metadata: any = {}
    try { metadata = JSON.parse(r.metadata || '{}') } catch { metadata = {} }
    return {
      id: String(r.id),
      senderId: String(r.sender_id),
      senderName: r.username || 'Unknown',
      senderProfilePicture: r.profile_picture_url || null,
      content: r.content,
      sentAt: r.sent_at,
      timestamp: new Date(r.sent_at * 1000).toISOString(),
      messageType: r.message_type || 'text',
      metadata,
      attachments,
      pinnedBy: r.pinned_by,
      pinnedByName: r.pinned_by_name,
      pinnedAt: r.pinned_at,
      isMine: r.sender_id === uid
    }
  })

  return jsonResponse(request, { pinned }, { status: 200 })
}

async function searchGifs(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })

  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''
  const limit = url.searchParams.get('limit') || '20'

  const apiKey = (env as any).KLIPY_API_KEY
  if (!apiKey) {
    return jsonResponse(request, { error: 'GIF service not configured' }, { status: 503 })
  }

  const klipyUrl = q
    ? `https://api.klipy.com/v2/search?q=${encodeURIComponent(q)}&key=${apiKey}&limit=${limit}&media_filter=gif,tinygif`
    : `https://api.klipy.com/v2/featured?key=${apiKey}&limit=${limit}&media_filter=gif,tinygif`

  try {
    const res = await fetch(klipyUrl)
    const json = await res.json() as any
    const results = (json.results || []).map((item: any) => ({
      id: item.id,
      url: item.media_formats?.gif?.url || '',
      previewUrl: item.media_formats?.tinygif?.url || '',
      width: item.media_formats?.gif?.dims?.[0] || 200,
      height: item.media_formats?.gif?.dims?.[1] || 200
    }))
    return jsonResponse(request, { results }, { status: 200 })
  } catch (err) {
    return jsonResponse(request, { error: 'Failed to fetch GIFs' }, { status: 500 })
  }
}

async function uploadVoiceMessage(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })

  if (!env.IMAGES) {
    return jsonResponse(request, { error: 'Storage not configured' }, { status: 500 })
  }

  const contentType = request.headers.get('content-type') || ''
  const allowedAudioTypes = ['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/x-m4a']
  if (!allowedAudioTypes.some(t => contentType.startsWith(t))) {
    return jsonResponse(request, { error: 'Invalid audio type' }, { status: 400 })
  }

  const MAX_VOICE_SIZE = 10 * 1024 * 1024
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > MAX_VOICE_SIZE) {
    return jsonResponse(request, { error: 'Audio too large (max 10MB)' }, { status: 400 })
  }

  try {
    const audioData = await request.arrayBuffer()
    if (audioData.byteLength > MAX_VOICE_SIZE) {
      return jsonResponse(request, { error: 'Audio too large (max 10MB)' }, { status: 400 })
    }

    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const key = `voice/${user.id}/${timestamp}-${random}`

    await env.IMAGES.put(key, audioData, {
      httpMetadata: {
        contentType: contentType.split(';')[0],
        contentDisposition: 'inline'
      }
    })

    const voiceUrl = `/api/images/${key}`
    return jsonResponse(request, { voiceUrl }, { status: 200 })
  } catch (err) {
    return jsonResponse(request, { error: 'Failed to upload voice message' }, { status: 500 })
  }
}

async function broadcastToConversation(env: Env, convId: string, message: any, excludeUserId: number): Promise<void> {
  try {
    const id = env.MESSAGE_WS.idFromName(`conversation:${convId}`)
    const stub = env.MESSAGE_WS.get(id)
    await stub.fetch(new Request('https://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({ ...message, excludeUserId })
    }))
  } catch (err) {
  }
}

async function broadcastToTeam(env: Env, teamId: string, message: any, excludeUserId: number): Promise<void> {
  try {
    const id = env.MESSAGE_WS.idFromName(`team:${teamId}`)
    const stub = env.MESSAGE_WS.get(id)
    await stub.fetch(new Request('https://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({ ...message, excludeUserId })
    }))
  } catch (err) {
  }
}

async function connectToConversationWS(request: Request, env: Env, convId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)

  if (!user) {
    return new Response('Not authenticated', { status: 401 })
  }

  const upgradeHeader = request.headers.get('Upgrade')
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 })
  }

  const id = env.MESSAGE_WS.idFromName(`conversation:${convId}`)
  const stub = env.MESSAGE_WS.get(id)

  const url = new URL(request.url)
  url.searchParams.set('userId', user.id)
  url.searchParams.set('username', (user as any).username || 'Unknown')
  url.searchParams.set('identifier', convId)

  return stub.fetch(new Request(url.toString(), {
    headers: request.headers
  }))
}

async function connectToTeamWS(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)

  if (!user) {
    return new Response('Not authenticated', { status: 401 })
  }

  const upgradeHeader = request.headers.get('Upgrade')
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 })
  }

  const id = env.MESSAGE_WS.idFromName(`team:${teamId}`)
  const stub = env.MESSAGE_WS.get(id)

  const url = new URL(request.url)
  url.searchParams.set('userId', user.id)
  url.searchParams.set('identifier', teamId)

  return stub.fetch(new Request(url.toString(), {
    headers: request.headers
  }))
}

async function getAllRecentConversations(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '5', 10)

  const [privsRes, chatsRes, starredRes] = await Promise.all([
    env.DB
      .prepare(
        `
        SELECT pc.id,
               pc.team_id,
               t.name AS team_name,
               t.image_url AS team_image_url,
               (SELECT content FROM messages m
                  WHERE m.conversation_id = pc.id
               ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
               (SELECT (m.deleted_at IS NOT NULL) FROM messages m
                  WHERE m.conversation_id = pc.id
               ORDER BY m.sent_at DESC LIMIT 1) AS last_message_deleted,
               (SELECT message_type FROM messages m
                  WHERE m.conversation_id = pc.id
               ORDER BY m.sent_at DESC LIMIT 1) AS last_message_type,
               (SELECT u.username FROM messages m
                  JOIN users u ON u.id = m.sender_id
                  WHERE m.conversation_id = pc.id
               ORDER BY m.sent_at DESC LIMIT 1) AS last_message_sender,
               (SELECT m.sent_at FROM messages m
                  WHERE m.conversation_id = pc.id
               ORDER BY m.sent_at DESC LIMIT 1) AS last_message_sent_at,
               pc.created_at,
               pc.updated_at,
               (SELECT COUNT(*) FROM messages m2
                 WHERE m2.conversation_id = pc.id
                   AND m2.sent_at > COALESCE(cp.last_read, 0)
                   AND m2.sender_id <> ?
               ) AS unread_count
          FROM private_conversations pc
          JOIN conversation_participants cp ON cp.conversation_id = pc.id
          JOIN team_members tm ON tm.team_id = pc.team_id AND tm.user_id = ?
          JOIN teams t ON t.id = pc.team_id
         WHERE cp.user_id = ?
           AND tm.chat_enabled = 1
        `
      )
      .bind(uid, uid, uid)
      .all<any>(),
    env.DB
      .prepare(
        `
        SELECT cr.id,
               cr.team_id,
               t.name AS team_name,
               t.image_url AS team_image_url,
               cr.name,
               (SELECT content FROM messages m
                  WHERE m.conversation_id = cr.id
               ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
               (SELECT (m.deleted_at IS NOT NULL) FROM messages m
                  WHERE m.conversation_id = cr.id
               ORDER BY m.sent_at DESC LIMIT 1) AS last_message_deleted,
               (SELECT message_type FROM messages m
                  WHERE m.conversation_id = cr.id
               ORDER BY m.sent_at DESC LIMIT 1) AS last_message_type,
               (SELECT u.username FROM messages m
                  JOIN users u ON u.id = m.sender_id
                  WHERE m.conversation_id = cr.id
               ORDER BY m.sent_at DESC LIMIT 1) AS last_message_sender,
               (SELECT m.sent_at FROM messages m
                  WHERE m.conversation_id = cr.id
               ORDER BY m.sent_at DESC LIMIT 1) AS last_message_sent_at,
               cr.created_at,
               cr.updated_at,
               (CASE WHEN gcu.user_id IS NULL THEN 0 ELSE (
                 SELECT COUNT(*) FROM messages m2
                   WHERE m2.conversation_id = cr.id
                     AND m2.sent_at > COALESCE(gcu.last_read, 0)
                     AND m2.sender_id <> ?
               ) END) AS unread_count
          FROM group_chats cr
          JOIN team_members tm ON tm.team_id = cr.team_id AND tm.user_id = ?
          LEFT JOIN group_chat_users gcu ON gcu.group_chat_id = cr.id AND gcu.user_id = ?
          JOIN teams t ON t.id = cr.team_id
         WHERE tm.chat_enabled = 1
           AND (gcu.user_id IS NOT NULL OR lower(tm.role) = 'owner')
        `
      )
      .bind(uid, uid, uid)
      .all<any>(),
    env.DB
      .prepare('SELECT conversation_id FROM starred_conversations WHERE user_id = ?')
      .bind(uid)
      .all<{ conversation_id: string }>(),
  ])

  const privs = privsRes.results || []
  const chats = chatsRes.results || []
  const starredIds = new Set((starredRes.results || []).map((r) => r.conversation_id))

  const combined = [
    ...privs.map((r: any) => ({
      id: String(r.id),
      name: null,
      type: 'private' as const,
      lastMessage: r.last_message_deleted ? 'Message was deleted' : (r.last_message || ''),
      lastMessageType: r.last_message_type || 'text',
      lastMessageSender: r.last_message_sender || null,
      lastMessageSentAt: r.last_message_sent_at != null ? Number(r.last_message_sent_at) : null,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
      unreadCount: r.unread_count,
      teamId: String(r.team_id),
      teamName: r.team_name || '',
      teamImageUrl: r.team_image_url,
      starred: starredIds.has(String(r.id)),
    })),
    ...chats.map((r: any) => ({
      id: String(r.id),
      name: r.name,
      type: 'group' as const,
      lastMessage: r.last_message_deleted ? 'Message was deleted' : (r.last_message || ''),
      lastMessageType: r.last_message_type || 'text',
      lastMessageSender: r.last_message_sender || null,
      lastMessageSentAt: r.last_message_sent_at != null ? Number(r.last_message_sent_at) : null,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
      unreadCount: r.unread_count,
      teamId: String(r.team_id),
      teamName: r.team_name || '',
      teamImageUrl: r.team_image_url,
      starred: starredIds.has(String(r.id)),
    }))
  ]

  const withMessages = combined.filter((c: any) => c.lastMessageSentAt != null)
  withMessages.sort((a: any, b: any) => {
    const aStarred = a.starred ? 1 : 0
    const bStarred = b.starred ? 1 : 0
    if (bStarred !== aStarred) return bStarred - aStarred
    return (b.lastMessageSentAt ?? 0) - (a.lastMessageSentAt ?? 0)
  })
  const limited = withMessages.slice(0, limit)

  return jsonResponse(request, { conversations: limited }, { status: 200 })
}

async function starConversation(request: Request, env: Env, convId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  const convRow = await env.DB
    .prepare(
      `SELECT c.team_id, tm.user_id FROM (
         SELECT id, team_id FROM group_chats WHERE id = ?
         UNION SELECT id, team_id FROM private_conversations WHERE id = ?
       ) c
       LEFT JOIN team_members tm ON tm.team_id = c.team_id AND tm.user_id = ?`
    )
    .bind(convId, convId, uid)
    .first<{ team_id: number; user_id: number | null }>()
  if (!convRow?.team_id) return jsonResponse(request, { error: 'Conversation not found' }, { status: 404 })
  if (!convRow.user_id) return jsonResponse(request, { error: 'Not a member of this conversation\'s team' }, { status: 403 })

  await env.DB
    .prepare('INSERT OR IGNORE INTO starred_conversations (user_id, conversation_id) VALUES (?, ?)')
    .bind(uid, convId)
    .run()

  return jsonResponse(request, { starred: true }, { status: 200 })
}

async function unstarConversation(request: Request, env: Env, convId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  const uid = Number(user.id)

  await env.DB
    .prepare('DELETE FROM starred_conversations WHERE user_id = ? AND conversation_id = ?')
    .bind(uid, convId)
    .run()

  return jsonResponse(request, { starred: false }, { status: 200 })
}

async function updateGroupChat(request: Request, env: Env, convId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })

  const uid = Number(user.id)

  const chat = await env.DB
    .prepare('SELECT id, team_id, name, access_type, allowed_roles, created_by FROM group_chats WHERE id = ?')
    .bind(convId)
    .first<any>()
  if (!chat) return jsonResponse(request, { error: 'Chat not found' }, { status: 404 })

  const tid = chat.team_id

  const member = await env.DB
    .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(tid, uid)
    .first<any>()
  if (!member) return jsonResponse(request, { error: 'Not a team member' }, { status: 403 })
  const role = (member.role || '').toLowerCase()
  if (role !== 'owner' && role !== 'coach') {
    return jsonResponse(request, { error: 'Only coaches and owners can edit chats' }, { status: 403 })
  }

  let data: any = {}
  try { data = await request.json() } catch { data = {} }

  const updates: string[] = []
  const binds: any[] = []

  if (typeof data.name === 'string' && data.name.trim()) {
    if (containsProfanity(data.name)) {
      return jsonResponse(request, { error: 'Chat name contains inappropriate language.' }, { status: 400 })
    }
    updates.push('name = ?')
    binds.push(data.name.trim())
  }

  if (data.accessType && ['everyone', 'roles', 'users', 'roles_and_users'].includes(data.accessType)) {
    updates.push('access_type = ?')
    binds.push(data.accessType)

    if (data.roles !== undefined) {
      updates.push('allowed_roles = ?')
      binds.push(Array.isArray(data.roles) && data.roles.length > 0 ? JSON.stringify(data.roles) : null)
    }
  }

  if (updates.length === 0) {
    return jsonResponse(request, { error: 'No valid fields to update' }, { status: 400 })
  }

  updates.push('updated_at = ?')
  binds.push(new Date().toISOString())
  binds.push(convId)

  await env.DB
    .prepare(`UPDATE group_chats SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run()

  if (data.accessType) {
    const newAccess = data.accessType
    const newRoles: string[] = data.roles || []
    const newUserIds: number[] = (data.userIds || []).map((id: any) => Number(id))

    await env.DB.prepare('DELETE FROM group_chat_users WHERE group_chat_id = ?').bind(convId).run()

    const insertStmts: D1PreparedStatement[] = []
    const insertPrep = env.DB.prepare(
      'INSERT INTO group_chat_users (group_chat_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING'
    )
    if (newAccess === 'everyone') {
      const teamMembers = await env.DB
        .prepare('SELECT user_id FROM team_members WHERE team_id = ?')
        .bind(tid)
        .all<any>()
      for (const m of teamMembers.results || []) {
        insertStmts.push(insertPrep.bind(convId, m.user_id))
      }
    } else if (newAccess === 'roles' && newRoles.length > 0) {
      const placeholders = newRoles.map(() => '?').join(',')
      const roleMembers = await env.DB
        .prepare(`SELECT user_id FROM team_members WHERE team_id = ? AND role IN (${placeholders})`)
        .bind(tid, ...newRoles)
        .all<any>()
      for (const m of roleMembers.results || []) {
        insertStmts.push(insertPrep.bind(convId, m.user_id))
      }
    } else if (newAccess === 'users') {
      for (const userId of newUserIds) {
        insertStmts.push(insertPrep.bind(convId, userId))
      }
    } else if (newAccess === 'roles_and_users') {
      if (newRoles.length > 0) {
        const placeholders = newRoles.map(() => '?').join(',')
        const roleMembers = await env.DB
          .prepare(`SELECT user_id FROM team_members WHERE team_id = ? AND role IN (${placeholders})`)
          .bind(tid, ...newRoles)
          .all<any>()
        for (const m of roleMembers.results || []) {
          insertStmts.push(insertPrep.bind(convId, m.user_id))
        }
      }
      for (const userId of newUserIds) {
        insertStmts.push(insertPrep.bind(convId, userId))
      }
    }
    if (insertStmts.length > 0) {
      await env.DB.batch(insertStmts)
    }
  }

  return jsonResponse(request, { success: true }, { status: 200 })
}

async function deleteGroupChat(request: Request, env: Env, convId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })

  const uid = Number(user.id)

  const chat = await env.DB
    .prepare('SELECT id, team_id, name FROM group_chats WHERE id = ?')
    .bind(convId)
    .first<any>()
  if (!chat) return jsonResponse(request, { error: 'Chat not found' }, { status: 404 })

  const tid = chat.team_id

  const member = await env.DB
    .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(tid, uid)
    .first<any>()
  if (!member) return jsonResponse(request, { error: 'Not a team member' }, { status: 403 })
  const role = (member.role || '').toLowerCase()
  if (role !== 'owner' && role !== 'coach') {
    return jsonResponse(request, { error: 'Only coaches and owners can delete chats' }, { status: 403 })
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = ?)').bind(convId),
    env.DB.prepare('DELETE FROM message_read_receipts WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = ?)').bind(convId),
    env.DB.prepare('DELETE FROM pinned_messages WHERE conversation_id = ?').bind(convId),
    env.DB.prepare('DELETE FROM poll_votes WHERE option_id IN (SELECT po.id FROM poll_options po JOIN polls p ON p.id = po.poll_id JOIN messages m ON m.id = p.message_id WHERE m.conversation_id = ?)').bind(convId),
    env.DB.prepare('DELETE FROM poll_options WHERE poll_id IN (SELECT p.id FROM polls p JOIN messages m ON m.id = p.message_id WHERE m.conversation_id = ?)').bind(convId),
    env.DB.prepare('DELETE FROM polls WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = ?)').bind(convId),
    env.DB.prepare('DELETE FROM messages WHERE conversation_id = ?').bind(convId),
    env.DB.prepare('DELETE FROM group_chat_users WHERE group_chat_id = ?').bind(convId),
    env.DB.prepare('DELETE FROM group_chats WHERE id = ?').bind(convId),
  ])

  return jsonResponse(request, { success: true }, { status: 200 })
}

export async function handleMessages(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const segments = pathname.split('/').filter(Boolean)
  const method = request.method

  if (pathname === '/devices/register' && method === 'POST') {
    return await registerDevice(request, env)
  }

  if (pathname === '/conversations/recent' && method === 'GET') {
    return await getAllRecentConversations(request, env)
  }

  if (segments[0] === 'gifs' && (segments[1] === 'search' || !segments[1]) && method === 'GET') {
    return await searchGifs(request, env)
  }
  if (segments[0] === 'gifs' && segments[1] === 'trending' && method === 'GET') {
    return await searchGifs(request, env)
  }

  if (pathname === '/upload/voice-message' && method === 'POST') {
    return await uploadVoiceMessage(request, env)
  }

  if (segments[0] === 'teams' && segments[2] === 'conversations') {
    if (method === 'GET' || method === 'POST') {
      return await manageConversations(request, env, segments[1])
    }
  }

  if (segments[0] === 'conversations' && segments[1] && segments[2] === 'star' && !segments[3]) {
    if (method === 'POST') return await starConversation(request, env, segments[1])
    if (method === 'DELETE') return await unstarConversation(request, env, segments[1])
  }

  if (segments[0] === 'conversations' && segments[1] && !segments[2] && method === 'PUT') {
    return await updateGroupChat(request, env, segments[1])
  }

  if (segments[0] === 'conversations' && segments[1] && !segments[2] && method === 'DELETE') {
    return await deleteGroupChat(request, env, segments[1])
  }

  if (segments[0] === 'conversations' && segments[2] === 'polls' && !segments[3] && method === 'POST') {
    return await createPoll(request, env, segments[1])
  }

  if (segments[0] === 'polls' && segments[1] && !segments[2] && method === 'GET') {
    return await getPoll(request, env, segments[1])
  }

  if (segments[0] === 'polls' && segments[2] === 'vote' && !segments[3] && method === 'POST') {
    return await votePoll(request, env, segments[1])
  }

  if (segments[0] === 'polls' && segments[2] === 'vote' && segments[3] && method === 'DELETE') {
    return await removePollVote(request, env, segments[1], segments[3])
  }

  if (segments[0] === 'conversations' && segments[2] === 'pinned' && !segments[3] && method === 'GET') {
    return await getPinnedMessages(request, env, segments[1])
  }

  if (segments[0] === 'conversations' && segments[2] === 'messages' && segments[4] === 'pin' && method === 'POST') {
    return await pinMessage(request, env, segments[1], segments[3])
  }

  if (segments[0] === 'conversations' && segments[2] === 'messages' && segments[4] === 'pin' && method === 'DELETE') {
    return await unpinMessage(request, env, segments[1], segments[3])
  }

  if (segments[0] === 'conversations' && segments[2] === 'messages' && segments[4] === 'reactions' && !segments[5] && method === 'POST') {
    return await handleReaction(request, env, segments[1], segments[3])
  }

  if (segments[0] === 'conversations' && segments[2] === 'messages' && segments[4] === 'reactions' && segments[5] && method === 'DELETE') {
    return await handleRemoveReaction(request, env, segments[1], segments[3], decodeURIComponent(segments[5]))
  }

  if (segments[0] === 'conversations' && segments[2] === 'messages' && segments[3] && !segments[4] && method === 'PUT') {
    return await editMessage(request, env, segments[1], segments[3])
  }

  if (segments[0] === 'conversations' && segments[2] === 'messages' && segments[3] && !segments[4] && method === 'DELETE') {
    return await deleteMessage(request, env, segments[1], segments[3])
  }

  if (segments[0] === 'conversations' && segments[2] === 'messages' && segments[3] === 'read' && method === 'POST') {
    return await markAsRead(request, env, segments[1])
  }

  if (segments[0] === 'conversations' && segments[2] === 'messages') {
    if (method === 'GET' || method === 'POST') {
      return await manageMessages(request, env, segments[1])
    }
  }

  if (segments[0] === 'messages' && segments[2] === 'read_by' && method === 'GET') {
    return await getReadBy(request, env, segments[1])
  }

  if (segments[0] === 'ws' && segments[1] === 'conversations' && segments[3] === 'messages' && request.headers.get('Upgrade') === 'websocket') {
    return await connectToConversationWS(request, env, segments[2])
  }

  if (segments[0] === 'ws' && segments[1] === 'teams' && segments[3] === 'conversations' && request.headers.get('Upgrade') === 'websocket') {
    return await connectToTeamWS(request, env, segments[2])
  }

  return null
}