import {
  json,
  readJsonBody,
  requireAdmin,
  supabaseRequest,
  writeActivityLog
} from '../../_shared/supabase.js';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateCompanyPayload(payload, isUpdate = false) {
  const errors = [];

  if (!isUpdate || payload.name !== undefined) {
    if (typeof payload.name !== 'string' || !payload.name.trim()) {
      errors.push('Company name is required and cannot be blank.');
    }
  }

  const shortName = payload.short_name || payload.shortName;
  if (!isUpdate || (payload.short_name !== undefined || payload.shortName !== undefined)) {
    if (typeof shortName !== 'string' || !shortName.trim()) {
      errors.push('Company short name is required and cannot be blank.');
    }
  }

  if (!isUpdate || payload.slug !== undefined) {
    if (typeof payload.slug !== 'string' || !SLUG_REGEX.test(payload.slug.trim())) {
      errors.push('Company slug must consist of lowercase alphanumeric characters and hyphens only (e.g. "tata-consultancy").');
    }
  }

  if (payload.founded !== undefined && payload.founded !== null && payload.founded !== '') {
    const yr = Number(payload.founded);
    if (!Number.isInteger(yr) || yr < 1800 || yr > 2200) {
      errors.push('Founded year must be an integer between 1800 and 2200.');
    }
  }

  return errors;
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const url = new URL(context.request.url);
    const search = url.searchParams.get('search');
    const categoryId = url.searchParams.get('category_id');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
    const isExport = url.searchParams.get('export') === 'true' || url.searchParams.get('format') === 'json';

    let queryPath = `/rest/v1/companies?select=*,company_categories(id,name,slug)&order=name.asc`;

    if (!isExport) {
      queryPath += `&limit=${limit}&offset=${offset}`;
    } else {
      queryPath += `&limit=500`;
    }

    if (categoryId && /^[0-9a-f-]{36}$/i.test(categoryId)) {
      queryPath += `&category_id=eq.${encodeURIComponent(categoryId)}`;
    }
    if (search && search.trim()) {
      queryPath += `&name=ilike.*${encodeURIComponent(search.trim())}*`;
    }

    const payload = await supabaseRequest(context.env, queryPath, {
      accessToken: auth.token
    });

    const records = Array.isArray(payload) ? payload : [];

    if (isExport) {
      return new Response(JSON.stringify(records, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="prepwise-companies.json"',
          'Cache-Control': 'no-store'
        }
      });
    }

    return json({
      data: records,
      limit,
      offset
    });
  } catch (error) {
    console.error('Companies GET error', error);
    return json({ error: 'Failed to retrieve companies' }, 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const body = await readJsonBody(context.request);
    const errors = validateCompanyPayload(body, false);
    if (errors.length > 0) {
      return json({ error: 'Validation failed', details: errors }, 400);
    }

    const slug = body.slug.trim().toLowerCase();
    const shortName = (body.short_name || body.shortName || body.name).trim();

    const record = {
      legacy_id: body.legacy_id || slug,
      name: body.name.trim(),
      short_name: shortName,
      slug,
      logo: body.logo || '🏢',
      logo_color: body.logo_color || body.logoColor || '#2563eb',
      logo_background: body.logo_background || body.logoBg || '#eff6ff',
      category_id: body.category_id || null,
      industry: body.industry ? body.industry.trim() : null,
      founded: body.founded ? Number(body.founded) : null,
      headquarters: body.headquarters ? body.headquarters.trim() : null,
      ceo: body.ceo ? body.ceo.trim() : null,
      employees: body.employees ? body.employees.trim() : null,
      website: body.website ? body.website.trim() : null,
      careers_url: body.careers_url || body.careersUrl || null,
      description: body.description ? body.description.trim() : null,
      history: body.history ? body.history.trim() : null,
      interview_process: body.interview_process || body.interviewProcess || null,
      is_published: Boolean(body.is_published)
    };

    const payload = await supabaseRequest(context.env, '/rest/v1/companies', {
      method: 'POST',
      accessToken: auth.token,
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([record])
    });

    const created = Array.isArray(payload) ? payload[0] : payload;
    await writeActivityLog(
      context.env,
      auth.token,
      auth.user.id,
      'create_company',
      'companies',
      created?.id || null,
      { slug: record.slug, name: record.name }
    );

    return json({ data: created, success: true }, 201);
  } catch (error) {
    console.error('Companies POST error', error);
    if (error.message === 'Request body must be a JSON object' || error.name === 'SyntaxError') {
      return json({ error: 'Request body must be a JSON object' }, 400);
    }
    const status = error.status === 409 || error.message?.includes('duplicate key') ? 409 : 500;
    const msg = status === 409 ? 'A company with this slug already exists' : (error.message || 'Failed to create company');
    return json({ error: msg }, status);
  }
}

export async function onRequestPatch(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return json({ error: 'A valid company UUID is required' }, 400);
    }

    const body = await readJsonBody(context.request);
    const errors = validateCompanyPayload(body, true);
    if (errors.length > 0) {
      return json({ error: 'Validation failed', details: errors }, 400);
    }

    const updates = { ...body, updated_at: new Date().toISOString() };
    delete updates.id;
    if (updates.slug) updates.slug = updates.slug.trim().toLowerCase();

    const payload = await supabaseRequest(
      context.env,
      `/rest/v1/companies?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        accessToken: auth.token,
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([updates])
      }
    );

    await writeActivityLog(
      context.env,
      auth.token,
      auth.user.id,
      'update_company',
      'companies',
      id,
      { updated_fields: Object.keys(updates) }
    );

    return json({ data: payload, success: true });
  } catch (error) {
    console.error('Companies PATCH error', error);
    if (error.message === 'Request body must be a JSON object' || error.name === 'SyntaxError') {
      return json({ error: 'Request body must be a JSON object' }, 400);
    }
    const status = error.status === 409 || error.message?.includes('duplicate key') ? 409 : 500;
    const msg = status === 409 ? 'A company with this slug already exists' : (error.message || 'Failed to update company');
    return json({ error: msg }, status);
  }
}

export async function onRequestDelete(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return json({ error: 'A single valid company UUID is required. Bulk deletion is strictly prohibited.' }, 400);
    }

    await supabaseRequest(
      context.env,
      `/rest/v1/companies?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        accessToken: auth.token
      }
    );

    await writeActivityLog(
      context.env,
      auth.token,
      auth.user.id,
      'delete_company',
      'companies',
      id
    );

    return json({ success: true, deleted_id: id });
  } catch (error) {
    console.error('Companies DELETE error', error);
    return json({ error: error.message || 'Failed to delete company' }, 500);
  }
}

