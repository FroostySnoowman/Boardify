import type { Env } from '../bindings'
import { jsonResponse } from '../http'
import { handleCrmOrganizations } from './organizations'
import { handleCrmPartnerships } from './partnerships'
import { handleCrmCampaigns } from './campaigns'
import { handleCrmTasks } from './tasks'
import { handleCrmUsers } from './users'
import { ensureCrmAccess } from './access'

export async function handleCrm(request: Request, env: Env, pathname: string): Promise<Response | null> {
    const access = await ensureCrmAccess(request, env)
    if (access instanceof Response) return access

    const segments = pathname.split('/').filter(Boolean)

    if (segments[1] === 'users') {
        return handleCrmUsers(request, env, pathname)
    }

    if (segments[1] === 'organizations') {
        return handleCrmOrganizations(request, env, pathname)
    }


    if (segments[1] === 'partnerships') {
        return handleCrmPartnerships(request, env, pathname)
    }

    if (segments[1] === 'campaigns') {
        return handleCrmCampaigns(request, env, pathname)
    }

    if (segments[1] === 'tasks') {
        return handleCrmTasks(request, env, pathname)
    }


    return jsonResponse(request, { error: 'Not found' }, { status: 404 })
}
