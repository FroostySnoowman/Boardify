import type { Env } from '../bindings'
import { jsonResponse } from '../http'
import { getCurrentUserFromSession } from '../auth'
import { sendEmail } from '../lib/email'
import { ensureCrmAccess } from './access'

async function sendCampaign(env: Env, campaign: any) {
    let query = 'SELECT email, name FROM crm_organizations WHERE email IS NOT NULL'
    const params: any[] = []

    if (campaign.target_audience && campaign.target_audience !== 'all') {
        const type = campaign.target_audience.toLowerCase()
        if (['club', 'coach', 'league', 'player'].includes(type)) {
            query += ' AND type = ?'
            params.push(type)
        }
    }

    const { results: recipients } = await env.DB.prepare(query).bind(...params).all()

    const smtp = env.SMTP_HOST ? {
        host: env.SMTP_HOST,
        port: parseInt(env.SMTP_PORT || '25', 10),
        username: env.SMTP_USER || '',
        password: env.SMTP_PASS || '',
    } : undefined

    const results = await Promise.all(recipients.map((recipient: any) =>
        sendEmail({
            to: recipient.email as string,
            subject: campaign.subject,
            html: campaign.content,
            text: campaign.content?.replace(/<[^>]*>?/gm, '')
        }, smtp).catch(() => ({ success: false }))
    ))
    const successCount = results.filter((r: any) => r.success).length

    // 3. Update campaign stats
    await env.DB.prepare(`
        UPDATE crm_campaigns 
        SET sent_count = ?, status = 'sent', sent_date = ? 
        WHERE id = ?
    `).bind(successCount, new Date().toISOString(), campaign.id).run()

    return successCount
}

export async function handleCrmCampaigns(request: Request, env: Env, pathname: string): Promise<Response | null> {
    const access = await ensureCrmAccess(request, env)
    if (access instanceof Response) return access
    const { user, permission } = access

    const canSendFrom = (fromName: string) => {
        return permission.mailboxAccess.includes(fromName) || permission.mailboxAccess.includes('all')
    }

    if (request.method === 'GET' && pathname === '/crm/campaigns') {
        const { results } = await env.DB.prepare('SELECT * FROM crm_campaigns ORDER BY created_at DESC').all()
        return jsonResponse(request, results)
    }

    if (request.method === 'POST' && pathname === '/crm/campaigns') {
        const data: any = await request.json()
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const status = data.status || 'draft'

        await env.DB.prepare(`
            INSERT INTO crm_campaigns (
                id, name, type, status, subject, content, target_audience,
                recipient_count, sent_count, open_rate, click_rate, scheduled_date, sent_date,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id, data.name, data.type, status, data.subject, data.content, data.targetAudience,
            data.recipientCount || 0, 0, 0, 0, data.scheduledDate, data.sentDate,
            now, now
        ).run()

        if (status === 'sent') {
            if (!canSendFrom('support')) {
                return jsonResponse(request, { error: 'Forbidden: No access to support mailbox' }, { status: 403 })
            }

            const campaign = { id, subject: data.subject, content: data.content, target_audience: data.targetAudience }
            await sendCampaign(env, campaign)
        }

        return jsonResponse(request, { id, message: 'Campaign created' }, { status: 201 })
    }

    if (request.method === 'PATCH' && pathname.startsWith('/crm/campaigns/')) {
        const id = pathname.split('/').pop()
        const data: any = await request.json()
        const sets: string[] = []
        const values: any[] = []

        const fields = ['name', 'type', 'status', 'subject', 'content', 'target_audience', 'recipient_count', 'sent_count', 'open_rate', 'click_rate', 'scheduled_date', 'sent_date']

        let shouldSend = false

        fields.forEach(field => {
            let val = data[field]
            if (field === 'target_audience') val = data.targetAudience
            else if (field === 'recipient_count') val = data.recipientCount
            else if (field === 'sent_count') val = data.sentCount
            else if (field === 'open_rate') val = data.openRate
            else if (field === 'click_rate') val = data.clickRate
            else if (field === 'scheduled_date') val = data.scheduledDate
            else if (field === 'sent_date') val = data.sentDate

            if (val !== undefined) {
                sets.push(`${field} = ?`)
                values.push(val)

                if (field === 'status' && val === 'sent') {
                    shouldSend = true
                }
            }
        })

        if (sets.length > 0) {
            sets.push('updated_at = ?')
            values.push(new Date().toISOString())
            values.push(id)
            await env.DB.prepare(`UPDATE crm_campaigns SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run()

            if (shouldSend) {
                const { results } = await env.DB.prepare('SELECT * FROM crm_campaigns WHERE id = ?').bind(id).all()
                if (results && results.length > 0) {
                    await sendCampaign(env, results[0])
                }
            }

            return jsonResponse(request, { message: 'Campaign updated' })
        }
    }

    if (request.method === 'DELETE' && pathname.startsWith('/crm/campaigns/')) {
        const id = pathname.split('/').pop()
        await env.DB.prepare('DELETE FROM crm_campaigns WHERE id = ?').bind(id).run()
        return jsonResponse(request, { message: 'Campaign deleted' })
    }

    return null
}
