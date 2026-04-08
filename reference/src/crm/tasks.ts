
import type { Env } from '../bindings'
import { jsonResponse } from '../http'
import { getCurrentUserFromSession } from '../auth'

export async function handleCrmTasks(request: Request, env: Env, pathname: string): Promise<Response | null> {
    const user = await getCurrentUserFromSession(request, env)
    if (!user) return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 })

    // GET /crm/tasks
    if (request.method === 'GET' && pathname === '/crm/tasks') {
        const { results } = await env.DB.prepare(`
            SELECT t.*, o.name as organization_name 
            FROM crm_tasks t
            LEFT JOIN crm_organizations o ON t.organization_id = o.id
            ORDER BY t.due_date ASC
        `).all()

        return jsonResponse(request, results)
    }

    // POST /crm/tasks
    if (request.method === 'POST' && pathname === '/crm/tasks') {
        const data: any = await request.json()
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        if (!data.title) {
            return jsonResponse(request, { error: 'Title is required' }, { status: 400 })
        }

        await env.DB.prepare(`
            INSERT INTO crm_tasks (
                id, title, description, category, priority, status, due_date, assignee,
                organization_id, partnership_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            data.title,
            data.description || null,
            data.category || 'follow_up',
            data.priority || 'medium',
            data.status || 'todo',
            data.dueDate || null,
            data.assignee || null,
            data.organizationId || null,
            data.partnershipId || null,
            now,
            now
        ).run()

        return jsonResponse(request, { id, message: 'Task created' }, { status: 201 })
    }

    // PATCH /crm/tasks/:id
    if (request.method === 'PATCH' && pathname.startsWith('/crm/tasks/')) {
        const id = pathname.split('/').pop()
        const data: any = await request.json()
        const sets: string[] = []
        const values: any[] = []

        const fields = ['title', 'description', 'category', 'priority', 'status', 'due_date', 'assignee', 'organization_id', 'partnership_id']

        fields.forEach(field => {
            let val = data[field]
            if (field === 'due_date') val = data.dueDate
            else if (field === 'organization_id') val = data.organizationId
            else if (field === 'partnership_id') val = data.partnershipId

            if (val !== undefined) {
                sets.push(`${field} = ?`)
                values.push(val)
            }
        })

        if (sets.length > 0) {
            sets.push('updated_at = ?')
            values.push(new Date().toISOString())
            values.push(id)
            await env.DB.prepare(`UPDATE crm_tasks SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run()
            return jsonResponse(request, { message: 'Task updated' })
        }
    }

    // DELETE
    if (request.method === 'DELETE' && pathname.startsWith('/crm/tasks/')) {
        const id = pathname.split('/').pop()
        await env.DB.prepare('DELETE FROM crm_tasks WHERE id = ?').bind(id).run()
        return jsonResponse(request, { message: 'Task deleted' })
    }

    return null
}
