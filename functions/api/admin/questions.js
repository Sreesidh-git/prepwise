import {
  json,
  readJsonBody,
  requireAdmin,
  supabaseRequest,
  writeActivityLog
} from '../../_shared/supabase.js';

const VALID_DIFFICULTIES = new Set(['Beginner', 'Intermediate', 'Advanced', 'Legend']);
const FORBIDDEN_MONOLOGUES = [
  /let\s+me\s+reconsider/i,
  /let\s+me\s+recalculate/i,
  /let\s+me\s+recheck/i,
  /let\s+me\s+re-read/i,
  /let\s+me\s+re-examine/i,
  /let\s+me\s+just\s+fix/i,
  /actually\s+the\s+answer\s+should\s+be/i,
  /answer\s+should\s+be/i,
  /i\s+will\s+change\s+the\s+question/i,
  /change\s+the\s+question/i,
  /none\s+of\s+the\s+available\s+options/i,
  /i('ll| will)\s+set\s+the\s+correct\s+answer/i,
  /wait,\s*that\s+gives/i,
  /wait,\s*let\s+me/i,
  /hmm,\s*but/i
];

function validateQuestionPayload(payload, isUpdate = false) {
  const errors = [];

  if (!isUpdate || payload.question_text !== undefined) {
    if (typeof payload.question_text !== 'string' || !payload.question_text.trim()) {
      errors.push('Question text is required and cannot be empty.');
    }
  }

  if (!isUpdate || payload.options !== undefined) {
    if (!Array.isArray(payload.options) || payload.options.length !== 4) {
      errors.push('Options must be an array of exactly 4 choices.');
    } else {
      const normalized = new Set();
      payload.options.forEach((opt, idx) => {
        if (typeof opt !== 'string' || !opt.trim()) {
          errors.push(`Option ${idx + 1} cannot be blank.`);
        } else {
          const key = opt.trim().toLowerCase();
          if (normalized.has(key)) {
            errors.push(`Duplicate option detected: "${opt.trim()}".`);
          }
          normalized.add(key);
        }
      });
    }
  }

  if (!isUpdate || payload.correct_answer !== undefined) {
    const ans = payload.correct_answer;
    if (typeof ans !== 'number' || !Number.isInteger(ans) || ans < 0 || ans > 3) {
      errors.push('Correct answer index must be an integer between 0 and 3.');
    }
  }

  if (!isUpdate || payload.difficulty !== undefined) {
    const diff = payload.difficulty || 'Intermediate';
    if (!VALID_DIFFICULTIES.has(diff)) {
      errors.push(`Difficulty must be one of: ${Array.from(VALID_DIFFICULTIES).join(', ')}.`);
    }
  }

  if (!isUpdate || payload.explanation !== undefined) {
    const exp = typeof payload.explanation === 'string' ? payload.explanation.trim() : '';
    if (!exp) {
      errors.push('Explanation cannot be empty.');
    } else {
      for (const pattern of FORBIDDEN_MONOLOGUES) {
        if (pattern.test(exp)) {
          errors.push('Explanation contains conversational monologue or recalculation artifacts.');
          break;
        }
      }
    }
  }

  return errors;
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const url = new URL(context.request.url);
    const companyId = url.searchParams.get('company_id');
    const categoryId = url.searchParams.get('category_id');
    const difficulty = url.searchParams.get('difficulty');
    const search = url.searchParams.get('search');
    const isExport = url.searchParams.get('export') === 'true' || url.searchParams.get('format') === 'json';
    const limit = isExport ? 2000 : Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    let queryPath = `/rest/v1/interview_questions?select=*,companies(id,name,slug),question_categories(id,name,slug)&order=created_at.desc&limit=${limit}&offset=${offset}`;

    if (companyId && /^[0-9a-f-]{36}$/i.test(companyId)) {
      queryPath += `&company_id=eq.${encodeURIComponent(companyId)}`;
    }
    if (categoryId && /^[0-9a-f-]{36}$/i.test(categoryId)) {
      queryPath += `&category_id=eq.${encodeURIComponent(categoryId)}`;
    }
    if (difficulty && VALID_DIFFICULTIES.has(difficulty)) {
      queryPath += `&difficulty=eq.${encodeURIComponent(difficulty)}`;
    }
    if (search && search.trim()) {
      queryPath += `&question_text=ilike.*${encodeURIComponent(search.trim())}*`;
    }

    const payload = await supabaseRequest(context.env, queryPath, {
      accessToken: auth.token
    });

    const records = Array.isArray(payload) ? payload : [];

    if (isExport) {
      return new Response(JSON.stringify({ questions: records }, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="prepwise-questions-export.json"',
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
    console.error('Questions GET error', error);
    return json({ error: 'Failed to retrieve interview questions' }, 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const body = await readJsonBody(context.request);

    // Handle batch JSON import
    if (Array.isArray(body.questions)) {
      const items = body.questions;
      if (items.length === 0) {
        return json({ error: 'Questions array cannot be empty' }, 400);
      }
      if (items.length > 500) {
        return json({ error: 'Maximum batch import size is 500 questions' }, 400);
      }

      const validatedRecords = [];
      const seenTexts = new Set();
      const allErrors = [];

      items.forEach((item, index) => {
        const errors = validateQuestionPayload(item, false);
        if (errors.length > 0) {
          allErrors.push(`Question #${index + 1}: ${errors.join('; ')}`);
        }
        const textKey = (item.question_text || item.question || '').trim().toLowerCase();
        if (seenTexts.has(textKey)) {
          allErrors.push(`Question #${index + 1}: Duplicate question text detected in import batch.`);
        }
        seenTexts.add(textKey);

        validatedRecords.push({
          company_id: item.company_id || body.company_id,
          category_id: item.category_id || null,
          question_text: (item.question_text || item.question || '').trim(),
          options: item.options.map((o) => String(o).trim()),
          correct_answer: typeof item.correct_answer === 'number' ? item.correct_answer : item.correctAnswer,
          explanation: (item.explanation || '').trim(),
          difficulty: item.difficulty || item.level || 'Intermediate',
          level: item.level || item.difficulty || 'Intermediate',
          is_published: item.is_published !== false
        });
      });

      if (allErrors.length > 0) {
        return json({ error: 'Import validation failed', details: allErrors }, 400);
      }

      const payload = await supabaseRequest(context.env, '/rest/v1/interview_questions', {
        method: 'POST',
        accessToken: auth.token,
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(validatedRecords)
      });

      await writeActivityLog(
        context.env,
        auth.token,
        auth.user.id,
        'import_questions',
        'interview_questions',
        null,
        { count: validatedRecords.length }
      );

      return json({ success: true, count: validatedRecords.length, data: payload }, 201);
    }

    // Single question creation
    const errors = validateQuestionPayload(body, false);
    if (errors.length > 0) {
      return json({ error: 'Validation failed', details: errors }, 400);
    }

    const record = {
      company_id: body.company_id,
      category_id: body.category_id || null,
      question_text: body.question_text.trim(),
      options: body.options.map((o) => o.trim()),
      correct_answer: body.correct_answer,
      explanation: (body.explanation || '').trim(),
      difficulty: body.difficulty || 'Intermediate',
      level: body.level || body.difficulty || 'Intermediate',
      is_published: Boolean(body.is_published),
      published_at: body.is_published ? new Date().toISOString() : null
    };

    const payload = await supabaseRequest(context.env, '/rest/v1/interview_questions', {
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
      'create_question',
      'interview_questions',
      created?.id || null,
      { difficulty: record.difficulty, company_id: record.company_id }
    );

    return json({ data: created, success: true }, 201);
  } catch (error) {
    console.error('Questions POST error', error);
    if (error.message === 'Request body must be a JSON object' || error.name === 'SyntaxError') {
      return json({ error: 'Request body must be a JSON object' }, 400);
    }
    return json({ error: error.message || 'Failed to create question' }, error.status || 500);
  }
}

export async function onRequestPatch(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return json({ error: 'A valid question UUID is required' }, 400);
    }

    const body = await readJsonBody(context.request);
    const errors = validateQuestionPayload(body, true);
    if (errors.length > 0) {
      return json({ error: 'Validation failed', details: errors }, 400);
    }

    const updates = { ...body, updated_at: new Date().toISOString() };
    delete updates.id;

    const payload = await supabaseRequest(
      context.env,
      `/rest/v1/interview_questions?id=eq.${encodeURIComponent(id)}`,
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
      'update_question',
      'interview_questions',
      id,
      { updated_fields: Object.keys(updates) }
    );

    return json({ data: payload, success: true });
  } catch (error) {
    console.error('Questions PATCH error', error);
    if (error.message === 'Request body must be a JSON object' || error.name === 'SyntaxError') {
      return json({ error: 'Request body must be a JSON object' }, 400);
    }
    return json({ error: error.message || 'Failed to update question' }, error.status || 500);
  }
}

export async function onRequestDelete(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return json({ error: 'A single valid question UUID is required. Bulk deletion is strictly prohibited.' }, 400);
    }

    await supabaseRequest(
      context.env,
      `/rest/v1/interview_questions?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        accessToken: auth.token
      }
    );

    await writeActivityLog(
      context.env,
      auth.token,
      auth.user.id,
      'delete_question',
      'interview_questions',
      id
    );

    return json({ success: true, deleted_id: id });
  } catch (error) {
    console.error('Questions DELETE error', error);
    return json({ error: error.message || 'Failed to delete question' }, 500);
  }
}

