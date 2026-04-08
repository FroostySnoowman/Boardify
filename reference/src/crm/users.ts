import type { Env } from '../bindings'
import { jsonResponse } from '../http'
import { ensureCrmAccess } from './access'

export async function handleCrmUsers(request: Request, env: Env, pathname: string): Promise<Response | null> {
    const access = await ensureCrmAccess(request, env)
    if (access instanceof Response) return access

    const { user, permission } = access

    // Only admins can manage users
    if (permission.role !== 'admin') {
        return jsonResponse(request, { error: 'Forbidden: Admins only' }, { status: 403 })
    }

    // GET /crm/users - List all users and their permissions
    if (request.method === 'GET' && pathname === '/crm/users') {
        // Fetch all CRM users
        const { results } = await env.DB.prepare(`
            SELECT u.id, u.email, u.username, u.profile_picture_url, p.role, p.mailbox_access, p.created_at
            FROM crm_user_permissions p
            JOIN users u ON u.id = p.user_id
            ORDER BY p.created_at DESC
        `).all()

        const users = results.map((r: any) => ({
            id: r.id,
            email: r.email,
            username: r.username,
            profilePictureUrl: r.profile_picture_url,
            role: r.role,
            mailboxAccess: JSON.parse(r.mailbox_access || '[]'),
            createdAt: r.created_at
        }))

        return jsonResponse(request, users)
    }

    // POST /crm/users - Grant access to a user (by email)
    if (request.method === 'POST' && pathname === '/crm/users') {
        const body: any = await request.json()
        const { email, role, mailboxAccess } = body

        if (!email || !role) {
            return jsonResponse(request, { error: 'Email and role required' }, { status: 400 })
        }

        // Find user by email
        const targetUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: number }>()

        if (!targetUser) {
            return jsonResponse(request, { error: 'User not found. They must sign up first.' }, { status: 404 })
        }

        // Upsert permission
        await env.DB.prepare(`
            INSERT INTO crm_user_permissions (user_id, role, mailbox_access) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET role = ?, mailbox_access = ?, updated_at = CURRENT_TIMESTAMP
        `).bind(
            targetUser.id, role, JSON.stringify(mailboxAccess || []),
            role, JSON.stringify(mailboxAccess || [])
        ).run()

        return jsonResponse(request, { message: 'User permissions updated' })
    }

    // DELETE /crm/users/:id - Revoke access
    if (request.method === 'DELETE' && pathname.startsWith('/crm/users/')) {
        const id = pathname.split('/').pop()

        // Prevent deleting self? Maybe.
        if (id === user.id) {
            return jsonResponse(request, { error: 'Cannot revoke your own access' }, { status: 400 })
        }

        await env.DB.prepare('DELETE FROM crm_user_permissions WHERE user_id = ?').bind(id).run()
        return jsonResponse(request, { message: 'User access revoked' })
    }

    return null
}
