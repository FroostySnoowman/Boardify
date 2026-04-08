
import type { Env } from '../bindings'
import { jsonResponse } from '../http'
import { getCurrentUserFromSession } from '../auth'

export async function handleCrmPartnerships(request: Request, env: Env, pathname: string): Promise<Response | null> {
    const user = await getCurrentUserFromSession(request, env)
    if (!user) return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 })

    // GET /crm/partnerships
    if (request.method === 'GET' && pathname === '/crm/partnerships') {
        const { results } = await env.DB.prepare(`
            SELECT p.*, o.name as organization_name 
            FROM crm_partnerships p
            LEFT JOIN crm_organizations o ON p.organization_id = o.id
            ORDER BY p.updated_at DESC
        `).all()

        return jsonResponse(request, results)
    }

    // POST /crm/partnerships
    if (request.method === 'POST' && pathname === '/crm/partnerships') {
        const data: any = await request.json()
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        await env.DB.prepare(`
            INSERT INTO crm_partnerships (
                id, title, organization_id, type, stage, value, probability, description,
                contact_name, contact_email, expected_close_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id, data.title, data.organizationId || null, data.type, data.stage || 'lead',
            data.value || 0, data.probability || 0, data.description,
            data.contactName, data.contactEmail, data.expectedCloseDate, now, now
        ).run()

        return jsonResponse(request, { id, message: 'Partnership created' }, { status: 201 })
    }

    // PATCH /crm/partnerships/:id
    if (request.method === 'PATCH' && pathname.startsWith('/crm/partnerships/')) {
        const id = pathname.split('/').pop()
        const data: any = await request.json()

        const sets: string[] = []
        const values: any[] = []

        const fields = ['title', 'organization_id', 'type', 'stage', 'value', 'probability', 'description', 'contact_name', 'contact_email', 'expected_close_date']

        fields.forEach(field => {
            let val = data[field]
            // Map camelCase to snake_case if needed
            if (field === 'organization_id') val = data.organizationId
            else if (field === 'contact_name') val = data.contactName
            else if (field === 'contact_email') val = data.contactEmail
            else if (field === 'expected_close_date') val = data.expectedCloseDate

            if (val !== undefined) {
                sets.push(`${field} = ?`)
                values.push(val)
            }
        })

        if (sets.length === 0) return jsonResponse(request, { message: 'No changes' })

        sets.push('updated_at = ?')
        values.push(new Date().toISOString())
        values.push(id)

        await env.DB.prepare(`UPDATE crm_partnerships SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run()
        return jsonResponse(request, { message: 'Partnership updated' })
    }

    // DELETE
    if (request.method === 'DELETE' && pathname.startsWith('/crm/partnerships/')) {
        const id = pathname.split('/').pop()
        await env.DB.prepare('DELETE FROM crm_partnerships WHERE id = ?').bind(id).run()
        return jsonResponse(request, { message: 'Partnership deleted' })
    }

    return null
}
