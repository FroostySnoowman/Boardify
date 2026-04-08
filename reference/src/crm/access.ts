import type { Env } from '../bindings'
import { getCurrentUserFromSession } from '../auth'
import { jsonResponse } from '../http'

export interface CrmPermission {
    userId: number
    role: 'admin' | 'agent'
    mailboxAccess: string[]
}

export async function getCrmPermission(env: Env, userId: number): Promise<CrmPermission | null> {
    const row = await env.DB.prepare('SELECT * FROM crm_user_permissions WHERE user_id = ?')
        .bind(userId)
        .first<{ user_id: number, role: string, mailbox_access: string }>()

    if (!row) return null

    let mailboxAccess: string[] = []
    try {
        mailboxAccess = JSON.parse(row.mailbox_access || '[]')
    } catch (e) {
        console.error('Failed to parse mailbox access', e)
    }

    return {
        userId: row.user_id,
        role: row.role as 'admin' | 'agent',
        mailboxAccess
    }
}

export async function canAccessMailbox(env: Env, userId: number, mailbox: string): Promise<boolean> {
    const perm = await getCrmPermission(env, userId)
    if (!perm) return false

    // Admins can access everything? Or just explicitly granted?
    // Let's say admins implicitly have full access or specified. 
    // Plan said "specify if they have access ... or all three".
    // "All three" implies explicit grant or wildcard.
    // Let's support explicit grant for now.

    return perm.mailboxAccess.includes(mailbox) || perm.mailboxAccess.includes('all')
}

export async function canAccessCrm(env: Env, userId: number): Promise<boolean> {
    const perm = await getCrmPermission(env, userId)
    return !!perm
}

export async function ensureCrmAccess(request: Request, env: Env): Promise<{ user: any, permission: CrmPermission } | Response> {
    const user = await getCurrentUserFromSession(request, env)
    if (!user) {
        return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 })
    }

    // Temporary bootstrap for jake@mybreakpoint.app to be admin if no permissions exist yet
    if (user.email === 'jake@mybreakpoint.app') {
        const hasPerm = await getCrmPermission(env, parseInt(user.id))
        if (!hasPerm) {
            // Auto-bootstrap admin
            await env.DB.prepare(`
                INSERT INTO crm_user_permissions (user_id, role, mailbox_access) VALUES (?, 'admin', '["all"]')
            `).bind(user.id).run()
        }
    }

    const permission = await getCrmPermission(env, parseInt(user.id))
    if (!permission) {
        return jsonResponse(request, { error: 'Forbidden: No CRM Access' }, { status: 403 })
    }

    return { user, permission }
}
