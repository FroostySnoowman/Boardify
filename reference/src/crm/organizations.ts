
import type { Env } from '../bindings'
import { jsonResponse } from '../http'
import { getCurrentUserFromSession } from '../auth'

export async function handleCrmOrganizations(request: Request, env: Env, pathname: string): Promise<Response | null> {
    // Auth check
    const user = await getCurrentUserFromSession(request, env)
    if (!user) {
        return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 })
    }

    // GET /crm/organizations - List all
    if (request.method === 'GET' && pathname === '/crm/organizations') {
        const { results } = await env.DB.prepare('SELECT * FROM crm_organizations ORDER BY created_at DESC').all()

        // Parse JSON tags
        const organizations = results.map((org: any) => ({
            ...org,
            tags: org.tags ? JSON.parse(org.tags) : []
        }))

        return jsonResponse(request, organizations)
    }

    // POST /crm/organizations - Create new
    if (request.method === 'POST' && pathname === '/crm/organizations') {
        try {
            const data: any = await request.json()

            // Validate required fields
            if (!data.name || !data.type) {
                return jsonResponse(request, { error: 'Missing required fields: name, type' }, { status: 400 })
            }

            const id = crypto.randomUUID()
            const now = new Date().toISOString()

            await env.DB.prepare(`
                INSERT INTO crm_organizations (
                    id, type, name, email, phone, website, location, status, source, tags, notes,
                    member_count, court_count, specialty, certification, sport_type, player_count, skill_level, matches_played, avatar_url,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                id, data.type, data.name, data.email || null, data.phone || null, data.website || null, data.location || null, data.status || 'lead', data.source || null, JSON.stringify(data.tags || []), data.notes || null,
                data.memberCount || null, data.courtCount || null, data.specialty || null, data.certification || null, data.sportType || null, data.playerCount || null, data.skillLevel || null, data.matchesPlayed || null, data.avatarUrl || null,
                now, now
            ).run()

            return jsonResponse(request, { id, message: 'Organization created' }, { status: 201 })
        } catch (e) {
            console.error(e)
            return jsonResponse(request, { error: 'Invalid data' }, { status: 400 })
        }
    }

    // PATCH /crm/organizations/:id - Update
    if (request.method === 'PATCH' && pathname.startsWith('/crm/organizations/')) {
        const id = pathname.split('/').pop()
        if (!id) return jsonResponse(request, { error: 'Invalid ID' }, { status: 400 })

        try {
            const data: any = await request.json()
            const sets: string[] = []
            const values: any[] = []

            const fields = [
                'type', 'name', 'email', 'phone', 'website', 'location', 'status', 'source', 'notes',
                'member_count', 'court_count', 'specialty', 'certification', 'sport_type', 'player_count', 'skill_level', 'matches_played', 'avatar_url'
            ]

            fields.forEach(field => {
                // CamelCase mapping if needed, simple mapping here
                const key = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase()); // To camelCase input check if incoming data has it
                // For simplicity, assuming incoming payload matches DB snake_case OR we manually map specific camelCase props from frontend
                // Let's assume frontend sends camelCase matching mockData types, so we map manually:

                let val = undefined
                if (field === 'member_count') val = data.memberCount
                else if (field === 'court_count') val = data.courtCount
                else if (field === 'sport_type') val = data.sportType
                else if (field === 'player_count') val = data.playerCount
                else if (field === 'skill_level') val = data.skillLevel
                else if (field === 'matches_played') val = data.matchesPlayed
                else if (field === 'avatar_url') val = data.avatarUrl
                else val = data[field] // try direct field name

                if (val !== undefined) {
                    sets.push(`${field} = ?`)
                    values.push(val)
                }
            })

            if (data.tags) {
                sets.push('tags = ?')
                values.push(JSON.stringify(data.tags))
            }

            if (sets.length === 0) return jsonResponse(request, { message: 'No changes' })

            sets.push('updated_at = ?')
            values.push(new Date().toISOString())
            values.push(id)

            await env.DB.prepare(`UPDATE crm_organizations SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run()

            return jsonResponse(request, { message: 'Organization updated' })
        } catch (e) {
            console.error(e)
            return jsonResponse(request, { error: 'Update failed' }, { status: 400 })
        }
    }

    // DELETE /crm/organizations/:id
    if (request.method === 'DELETE' && pathname.startsWith('/crm/organizations/')) {
        const id = pathname.split('/').pop()
        await env.DB.prepare('DELETE FROM crm_organizations WHERE id = ?').bind(id).run()
        return jsonResponse(request, { message: 'Organization deleted' })
    }

    return null
}
